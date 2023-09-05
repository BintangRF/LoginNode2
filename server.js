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

app.get("/dashboard", (req, res) => {
  if (req.session.userId) {
    const userId = req.session.userId;
    const query = "SELECT nama_pasien FROM tb_pasien WHERE id_pasien = ?";
    db.query(query, [userId], (err, results) => {
      if (err) throw err;
      if (results.length === 1) {
        const nama_pasien = results[0].nama_pasien;
        res.render("dashboard.ejs", { nama: nama_pasien }); // Ubah nama_pasien menjadi nama
      } else {
        res.redirect("/login");
      }
    });
  } else {
    res.render("dashboard.ejs", { nama: null });
  }
});

// Route untuk halaman appointment
app.get("/appointment", (req, res) => {
  if (req.session.userId) {
    // Render halaman appointment jika pengguna sudah login
    const userId = req.session.userId;
    const query = "SELECT nama_pasien FROM tb_pasien WHERE id_pasien = ?";
    db.query(query, [userId], (err, results) => {
      if (err) throw err;
      if (results.length === 1) {
        const nama_pasien = results[0].nama_pasien;

        // Ambil daftar nama psikolog dari database
        db.query(
          "SELECT id_psikolog, nama_psikolog FROM tb_psikolog",
          (err, psikolog) => {
            if (err) {
              throw err;
            }
            // Render halaman appointment dengan data nama pasien dan psikolog
            res.render("appointment", { nama: nama_pasien, psikolog });
          }
        );
      }
    });
  } else {
    // Jika pengguna belum login, kirimkan pesan alert dan arahkan ke halaman login
    const alertMessage = "Anda belum login. Silahkan login terlebih dahulu.";
    const loginRedirect = "/login";

    res.send(`
      <script>
        alert('${alertMessage}');
        window.location='${loginRedirect}';
      </script>
    `);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect("/dashboard");
  });
});

// Implementasi POST routes untuk form submission

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});

// SIGNUP
app.post("/signup", (req, res) => {
  const {
    nama_pasien,
    tanggal_lahir,
    gender,
    nomor_ponsel,
    email,
    alamat,
    password,
  } = req.body;

  // Simpan data pengguna ke database
  const user = {
    nama_pasien,
    tanggal_lahir,
    gender,
    nomor_ponsel,
    email,
    alamat,
    password, // Simpan kata sandi dalam teks biasa
  };

  const query = "INSERT INTO tb_pasien SET ?";
  db.query(query, user, (err, results) => {
    if (err) {
      throw err;
    }

    // Tampilkan pesan sukses dan arahkan pengguna ke halaman login
    const successMessage = "Pendaftaran berhasil";
    res.send(`
      <script>
        alert('${successMessage}');
        window.location='/login'; // Ubah '/login' sesuai dengan URL login Anda
      </script>
    `);
  });
});

//

// LOGIN
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
        req.session.nama_pasien = user.nama_pasien; // Menyimpan nama pengguna dalam sesi
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
//

// APPOINTMENT
app.post("/appointment", (req, res) => {
  const { nama_pasien, nama_psikolog, tanggal, waktu, keluhan } = req.body;

  // Query SQL untuk mengambil id_pasien berdasarkan nama_pasien
  const getIdPasienQuery =
    "SELECT id_pasien FROM tb_pasien WHERE nama_pasien = ?";

  db.query(getIdPasienQuery, [nama_pasien], (err, pasienResults) => {
    if (err) {
      throw err;
    }

    if (pasienResults.length === 0) {
      res.status(400).send("Nama pasien tidak ditemukan"); // Handle jika nama pasien tidak ditemukan
      return;
    }

    const id_pasien = pasienResults[0].id_pasien; // Mengambil id_pasien yang sesuai

    // Query SQL untuk mengambil id_psikolog berdasarkan nama_psikolog
    const getIdPsikologQuery =
      "SELECT nama_psikolog FROM tb_psikolog WHERE id_psikolog = ?";

    db.query(getIdPsikologQuery, [nama_psikolog], (err, psikologResults) => {
      if (err) {
        throw err;
      }

      if (psikologResults.length === 0) {
        res.status(400).send("Nama psikolog tidak ditemukan"); // Handle jika nama psikolog tidak ditemukan
        return;
      }

      const nama_psikolog = psikologResults[0].nama_psikolog; // Mengambil id_psikolog yang sesuai

      // Simpan data appointment ke database dengan id_pasien dan id_psikolog yang sesuai
      const appointment = {
        id_pasien,
        nama_pasien,
        nama_psikolog,
        tanggal,
        waktu,
        keluhan,
      };

      // Query SQL untuk memasukkan data appointment ke dalam tb_appointment
      const insertQuery = "INSERT INTO tb_appointment SET ?";

      db.query(insertQuery, appointment, (err, result) => {
        if (err) {
          throw err;
        }

        // Tampilkan pesan sukses dan arahkan kembali ke halaman dashboard
        const successMessage = "Appointment berhasil";
        res.send(`
          <script>
            alert('${successMessage}');
            window.location='/dashboard'; // Ubah '/dashboard' sesuai dengan URL dashboard Anda
          </script>
        `);
      });
    });
  });
});

//
