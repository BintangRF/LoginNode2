const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();
const multer = require("multer");
const fs = require("fs");

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

// Middleware untuk memeriksa apakah pengguna sudah login
const checkLoggedIn = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
};

// poto-profil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Simpan gambar di folder "uploads/"
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname); // Nama file unik
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // Batas ukuran file (misalnya, 5MB)
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Folder untuk file publik (CSS, gambar, dll.)

// Routing
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// Route Login
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// Route Signup
app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

// Route Dashboard
app.get("/dashboard", (req, res) => {
  if (req.session.userId) {
    const userId = req.session.userId;
    const query =
      "SELECT nama_pasien, foto_pasien FROM tb_pasien WHERE id_pasien = ?";
    db.query(query, [userId], (err, results) => {
      if (err) throw err;
      if (results.length === 1) {
        const { nama_pasien, foto_pasien } = results[0];
        const id_pasien = userId;
        res.render("dashboard.ejs", {
          nama: nama_pasien,
          id_pasien: id_pasien,
          foto_pasien: foto_pasien, // Menambahkan foto_pasien ke konteks template
        });
      } else {
        res.redirect("/login");
      }
    });
  } else {
    res.render("dashboard.ejs", {
      nama: null,
      id_pasien: null,
      foto_pasien: null,
    });
  }
});

// Route untuk halaman appointment
app.get("/appointment", (req, res) => {
  if (req.session.userId) {
    const userId = req.session.userId;
    const query =
      "SELECT id_pasien, nama_pasien, email_pasien FROM tb_pasien WHERE id_pasien = ?";

    db.query(query, [userId], (err, results) => {
      if (err) {
        throw err;
      }
      if (results.length === 1) {
        const id_pasien = results[0].id_pasien;
        const nama_pasien = results[0].nama_pasien;
        const email_pasien = results[0].email_pasien;

        // Ambil daftar nama psikolog dari database
        db.query(
          "SELECT id_psikolog, nama_psikolog FROM tb_psikolog",
          (err, psikolog) => {
            if (err) {
              throw err;
            }

            // Render halaman appointment dengan data nama pasien, psikolog, email_pasien, dan id_pasien
            res.render("appointment", {
              nama: nama_pasien,
              psikolog,
              email_pasien,
              id_pasien,
            });
          }
        );
      }
    });
  } else {
    // Jika pengguna belum login, kirimkan pesan alert dan arahkan ke halaman login
    const alertMessage = "Anda belum login. Silakan login terlebih dahulu.";
    const loginRedirect = "/login";

    res.send(`
      <script>
        alert('${alertMessage}');
        window.location='${loginRedirect}';
      </script>
    `);
  }
});

// Route untuk halaman profil
app.get("/profile", checkLoggedIn, (req, res) => {
  const id_pasien = req.session.userId;

  // Query SQL untuk mengambil data pengguna dari tb_pasien
  const query =
    "SELECT foto_pasien, id_pasien, email_pasien, nama_pasien, alamat, nomor_ponsel FROM tb_pasien WHERE id_pasien = ?";

  db.query(query, [id_pasien], (err, results) => {
    if (err) {
      throw err;
    }

    if (results.length === 1) {
      const profileData = results[0];

      // Render halaman profil dengan data pengguna
      res.render("profile.ejs", { profileData });
    }
  });
});

// Edit Profile
app.get("/edit_profile", checkLoggedIn, (req, res) => {
  const id_pasien = req.session.userId;

  // Query SQL untuk mengambil data pengguna dari tb_pasien
  const query =
    "SELECT id_pasien, email_pasien, nama_pasien, alamat, nomor_ponsel FROM tb_pasien WHERE id_pasien = ?";

  db.query(query, [id_pasien], (err, results) => {
    if (err) {
      throw err;
    }

    if (results.length === 1) {
      const profileData = results[0];

      // Render halaman edit profil dengan data pengguna
      res.render("edit_profile.ejs", { profileData });
    }
  });
});

// Route Logout
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

app.post("/signup", upload.single("foto_pasien"), (req, res) => {
  const {
    nama_pasien,
    tanggal_lahir,
    gender,
    nomor_ponsel,
    email_pasien,
    alamat,
    password,
  } = req.body;

  // Ambil file gambar yang diunggah
  const foto_pasien = req.file;

  // Pastikan file gambar telah diunggah dengan benar
  if (!foto_pasien) {
    return res.status(400).send("Gambar profil harus diunggah.");
  }

  // Konversi gambar menjadi bentuk Base64
  const gambarBase64 = fs.readFileSync(foto_pasien.path, "base64");

  // Simpan data pengguna ke database, termasuk gambar profil
  const user = {
    foto_pasien: gambarBase64, // Simpan gambar dalam format Base64
    nama_pasien,
    tanggal_lahir,
    gender,
    nomor_ponsel,
    email_pasien,
    alamat,
    password, // Simpan kata sandi dalam teks biasa (tanpa hashing)
  };

  const query = "INSERT INTO tb_pasien SET ?";
  db.query(query, user, (err, results) => {
    if (err) {
      return res.status(500).send("Pendaftaran gagal. Coba lagi nanti.");
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
  const { email_pasien, password } = req.body;
  const query = "SELECT * FROM tb_pasien WHERE email_pasien = ?";

  db.query(query, [email_pasien], (err, results) => {
    if (err) throw err;

    if (results.length === 1) {
      const user = results[0];
      if (password === user.password) {
        // Memeriksa kata sandi tanpa hashing
        // Sesuaikan sesi pengguna di sini
        req.session.userId = user.id_pasien;
        req.session.nama_pasien = user.nama_pasien;
        req.session.email_pasien = user.email_pasien; // Menyimpan email_pasien dalam sesi
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

// Update Profil
app.post(
  "/edit_profile",
  checkLoggedIn,
  upload.single("foto_pasien"),
  (req, res) => {
    const id_pasien = req.session.userId;
    const { nama_pasien, email_pasien, alamat, nomor_ponsel } = req.body;

    // Lakukan validasi dan pembaruan data profil di sini sesuai kebutuhan
    // Misalnya, Anda dapat melakukan validasi data yang diterima dan memastikan data tersebut valid

    // Jika foto profil berhasil diunggah, Anda dapat menghandle pembaruan gambar profil di sini
    if (req.file) {
      const newProfilePicture = req.file.filename;
      // Lakukan sesuatu dengan gambar profil yang baru diunggah, jika diperlukan
    }

    // Query SQL untuk melakukan pembaruan data profil di tabel tb_pasien
    const updateQuery =
      "UPDATE tb_pasien SET nama_pasien = ?, email_pasien = ?, alamat = ?, nomor_ponsel = ? WHERE id_pasien = ?";

    db.query(
      updateQuery,
      [nama_pasien, email_pasien, alamat, nomor_ponsel, id_pasien],
      (err, result) => {
        if (err) {
          // Handle kesalahan jika query gagal
          console.error("Kesalahan saat memperbarui profil:", err);
          return res
            .status(500)
            .send("Terjadi kesalahan saat memperbarui profil.");
        }

        // Setelah pembaruan berhasil, tampilkan pesan sukses dan arahkan ke halaman profil
        const successMessage = "Profil berhasil diperbarui";
        res.send(`
        <script>
          alert('${successMessage}');
          window.location='/profile'; // Redirect ke halaman profil
        </script>
      `);
      }
    );
  }
);

//

// APPOINTMENT
app.post("/appointment", (req, res) => {
  const { nama_pasien, nama_psikolog, tanggal, waktu, keluhan } = req.body;
  const email_pasien = req.session.email_pasien; // Mengambil email_pasien dari sesi

  // Query SQL untuk mengambil id_pasien berdasarkan nama_pasien
  const getIdPasienQuery =
    "SELECT id_pasien FROM tb_pasien WHERE nama_pasien = ? AND email_pasien = ?";

  db.query(
    getIdPasienQuery,
    [nama_pasien, email_pasien],
    (err, pasienResults) => {
      if (err) {
        throw err;
      }

      if (pasienResults.length === 0) {
        res.status(400).send("Nama pasien tidak ditemukan"); // Handle jika nama pasien tidak ditemukan
        return;
      }

      const id_pasien = pasienResults[0].id_pasien; // Mengambil id_pasien yang sesuai

      // Query SQL untuk mengambil nama_psikolog berdasarkan id_psikolog
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

        const nama_psikolog = psikologResults[0].nama_psikolog; // Mengambil nama_psikolog yang sesuai

        // Simpan data appointment ke database dengan id_pasien, nama_psikolog, dan email_pasien yang sesuai
        const appointment = {
          id_pasien,
          email_pasien, // Memasukkan email_pasien yang sesuai
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
    }
  );
});

//
