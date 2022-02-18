create database test;
create table if not exists rectangle (
    id serial,
    name varchar(512) not null,
    description varchar(1024) default '',
    width int not null,
    height int not null,
    color varchar(8) not null,
    comment varchar(1024) default ''
);
