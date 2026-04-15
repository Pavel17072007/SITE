const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require("bcrypt");
const session = require("express-session");


const app = express();
app.use(express.json());
const port = 3000;

  app.use(express.static(__dirname));
// Middleware для обработки данных формы (urlencoded)
app.use(bodyParser.urlencoded({ extended: true }));

// Настройка подключения к MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1111',
  database: 'my_database'
});

db.connect(err => {
  if (err) {
    console.error('Ошибка подключения к MySQL:', err);
    return;
  }
  console.log('Успешное подключение к MySQL');
});
// запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});

app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
});
