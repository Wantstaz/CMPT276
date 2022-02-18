//
var os           = require('os');
var fs           = require('fs');
var util         = require('util');
var crypto       = require('crypto');
var pgsql        = require('pg');
var express      = require('express');
var cookieParser = require('cookie-parser');
var session      = require('express-session');
var app          = express();

const PORT = process.env.PORT || 5000;
//
var routeConfig = {
};
//
documentRoot = __dirname + '/public';
//
var pgConfig = {
    //user: 'ndnmzdabmvcjfy',
    //host: 'ec2-54-209-221-231.compute-1.amazonaws.com',
    //port: 5432,
    //database: 'dfpdq79vbslivh',
    //password: '9db764fa1867ae41476378d6c18e14a6f1c971aa73f5407046e90eebcbb736ce',
    max: 20,
    connectionTimeoutMillis: 5000,
    connectionString: process.env.DATABASE_URL,
    ssl: {
    	rejectUnauthorized: false,
    },
    idleTimeoutMillis: 5000
};
pgsqlConnection = new pgsql.Pool(pgConfig);
//
var sessionSecret = 'SESS_';
app.use(cookieParser(sessionSecret));
//session setting
app.use(session({
    secrect: sessionSecret,
    name   : 'session_id',
    resave : false,
    saveUninitialized: true,
    cookie: {secure: false}
}));
app.use(express.urlencoded({extended: true}));//parsing application/x-www-form-urlencoded
app.use(express.json());//parsing application/json
// static resource(css/js/img) file
app.get(/(\/css\/|\/js\/|\.(jpg|jpeg|png|gif|ico)).*/, function(request, response) {
    console.log('[Request]: ' + request.path);
    resourceFile = documentRoot + request.path;
    response.sendFile(resourceFile, function(err) {
        if(err) {
            console.error('[Resource]: ' + resourceFile + ' not found!, request path: ' + request.path);
        }
    });
});
// index page
app.get('/', function(request, response) {
    pgsqlConnection.connect(function(error, client, releaseFn) {
        if (error) {
            releaseFn();
            return console.log('Connection failed: ' + error);
        }
        console.log('Connection OK');
        var listSql = 'SELECT * FROM rectangle';
        client.query(listSql, function(error, results) {
            releaseFn();
            console.log('Query OK');
            var viewHtml = getViewFileContent(request, response);
            response.status(200)
                    .send(viewHtml.replace('{{jsonData}}', JSON.stringify(results.rows)));
        });
    });
});
// view page
app.get('/view.html', function(request, response) {
    var rid = request.query['id'] ? request.query['id'] : null;
    if(!rid) {
        response.status(200)
                .send({text: 'Invalid parameter id provided'});
    } else {
        pgsqlConnection.connect(function(error, client, releaseFn) {
            if (error) {
                releaseFn();
                return console.log('Connection failed: ' + error);
            }
            console.log('Connection OK');
            var listSql = 'SELECT * FROM rectangle WHERE id=$1';
            client.query(listSql, [rid], function(error, results) {
                releaseFn();
                console.log('Query OK');
                var viewHtml = getViewFileContent(request, response);
                response.status(200)
                        .send(viewHtml.replace('{{jsonData}}',
                            results.rowCount ? JSON.stringify(results.rows[0]) : 'null')
                        );
            });
        });
    }
});
// edit page
app.get('/edit.html', function(request, response) {
    var rid = request.query['id'] ? request.query['id'] : null;
    if(!rid) {
        response.status(200)
                .send({text: 'Invalid parameter id provided'});
    } else {
        pgsqlConnection.connect(function(error, client, releaseFn) {
            if (error) {
                releaseFn();
                return console.log('Connection failed: ' + error);
            }
            console.log('Connection OK');
            var listSql = 'SELECT * FROM rectangle WHERE id=$1';
            client.query(listSql, [rid], function(error, results) {
                releaseFn();
                console.log('Query OK');
                var viewHtml = getViewFileContent(request, response);
                var data = {saved: false};
                if(results.rowCount > 0) {
                    data = results.rows[0];
                    data['saved'] = false;
                }
                response.status(200)
                        .send(viewHtml.replace('{{jsonData}}', JSON.stringify(data)));
            });
        });
    }
});
// new page
app.get('/new.html', function(request, response) {
    var viewHtml = getViewFileContent(request, response);
    var placeHolder = {
        saved: false, name: '', description: '', width: 10, height: 10,
        color: 'FFFFFF', comment: '',
    };
    response.status(200)
            .send(viewHtml.replace('{{jsonData}}', JSON.stringify(placeHolder)));
});

// delete
app.get('/delete.html', function(request, response) {
    var rid = request.query['id'] ? request.query['id'] : null;
    if(!rid) {
        response.status(200)
                .send({text: 'Invalid parameter id provided'});
    } else {
        pgsqlConnection.connect(function(error, client, releaseFn) {
            if (error) {
                releaseFn();
                return console.log('Connection failed: ' + error);
            }
            console.log('Connection OK');
            var deleteSql = 'DELETE FROM rectangle WHERE id=$1';
            client.query(deleteSql, [rid], function(error, results) {
                releaseFn();
                console.log('Query OK');
                var viewHtml = getViewFileContent(request, response);
                response.status(200)
                        .send(viewHtml.replace('{{jsonData}}',
                            results.rowCount ? JSON.stringify(results.rows[0]) : 'null')
                        );
            });
        });
    }
});
// save
app.post('/save', function(request, response) {
    var rid = request.body.id ? request.body.id : 0;
    var name= request.body.name;
    var description = request.body.description;
    var width = request.body.width;
    var height= request.body.height;
    var color = request.body.color;
    var comment = request.body.comment;
    try {
        width = parseInt(width);
        height= parseInt(height);
    } catch (e) {
        response.status(400)
                .send({success: false, text: 'Invalid width / height which must be positive integers'});
        return ;
    }
    if(!name || !color || width <= 0 || height <= 0) {
        response.status(400)
                .send({success: false, text: 'Invalid name / width / height which must be positive integers'});
        return ;
    } else {
        pgsqlConnection.connect(function(error, client, releaseFn) {
            if (error) {
                releaseFn();
                return console.log('Connection failed: ' + error);
            }
            console.log('Connection OK');
            var sql = '';
            var values = [];
            if(rid > 0) {// update
                sql = 'UPDATE rectangle SET name=$1, description=$2, width=$3, height=$4, color=$5, comment=$6 WHERE id=$7';
                values = [name, description, width, height, color, comment, rid];
            } else {// new
                sql = 'INSERT INTO rectangle (name, description, width, height, color, comment) VALUES($1, $2, $3, $4, $5, $6)';
                values = [name, description, width, height, color, comment];
            }
            client.query(sql, values, function(error, results) {
                releaseFn();
                console.log('Query OK');
                response.status(200)
                        .send({success: true, text: 'OK'});
            });
        });

    }
});
//
var server = app.listen(PORT, function() {
    console.log('Listening ' + PORT + '...');
});

function getViewFileContent(request, response)
{
    path = request.path;
    if('' == path || '/' == path) {
        path = '/home.html';
    }
    viewHtmlFile = documentRoot + path;
    viewHtml = fs.readFileSync(viewHtmlFile, {encoding: 'utf-8'});
    return viewHtml;
}
