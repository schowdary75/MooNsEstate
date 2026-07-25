const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize('moonestates', 'root', '', {
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

module.exports = { sequelize, DataTypes, Op };
