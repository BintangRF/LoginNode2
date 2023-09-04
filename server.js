const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "db_rumah_sakit",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Terhubung ke MySQL");
});

// Konfigurasi Express
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "your_secret_key",
    resave: true,
    saveUninitialized: true,
  })
);
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/views"));

// Routing
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

// Implementasi POST routes untuk form submission

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});

app.post("/signup", (req, res) => {
  const { nama, tanggal_lahir, gender, nomor_ponsel, email, alamat, password } =
    req.body;

  // Simpan data pengguna ke database
  const user = {
    nama,
    tanggal_lahir,
    gender,
    nomor_ponsel,
    email,
    alamat,
    password, // Simpan kata sandi dalam teks biasa
  };

  const query = "INSERT INTO tb_pasien SET ?";
  db.query(query, user, (err, results) => {
    if (err) throw err;
    console.log("Pengguna terdaftar");
    res.redirect("/login");
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const query = "SELECT * FROM tb_pasien WHERE email = ?";

  db.query(query, [email], (err, results) => {
    if (err) throw err;

    if (results.length === 1) {
      const user = results[0];
      if (password === user.password) {
        // Memeriksa kata sandi tanpa hashing
        // Sesuaikan sesi pengguna di sini
        req.session.userId = user.id_pasien;
        res.redirect("/dashboard");
      } else {
        res.send(
          "<script>alert('Password Anda salah'); window.location='/login';</script>"
        );
      }
    } else {
      res.send(
        "<script>alert('Email tidak ditemukan'); window.location='/login';</script>"
      );
    }
  });
});

app.get("/dashboard", (req, res) => {
  if (req.session.userId) {
    const userId = req.session.userId;
    const query = "SELECT nama FROM tb_pasien WHERE id_pasien = ?";
    db.query(query, [userId], (err, results) => {
      if (err) throw err;
      if (results.length === 1) {
        const nama = results[0].nama;
        res.render("dashboard.ejs", { nama });
      } else {
        res.redirect("/login");
      }
    });
  } else {
    res.render("dashboard.ejs", { nama: null });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect("/dashboard");
  });
});
