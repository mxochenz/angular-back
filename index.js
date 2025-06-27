const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwtUtil = require("jsonwebtoken");
const app = express();
const jwtParser = require("./jwt-parser");
const connection = require("./connection-db");

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { log } = require("console");

// Filtrer les types de fichiers acceptés
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Type de fichier non autorisé"), false);
  }
  cb(null, true);
};

// Nettoyage du nom de fichier
const sanitize = (name) => name.replace(/[^a-zA-Z0-9.]/g, "_").substring(0, 50);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public", "upload"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non supporté"), false);
    }
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("hello");
});

// route GET /users
app.get("/users", jwtParser, (req, res) => {
  const role = req.query.role;

  let query = "SELECT id, email, role_id FROM users";
  const params = [];

  if (role === "stagiaire") {
    query += " WHERE role_id = ?";
    params.push(3); // ID du rôle stagiaire
  }

  connection.query(query, params, (err, users) => {
    if (err) return res.sendStatus(500);
    res.json(users);
  });
});

// inscription
app.post("/inscription", (req, res) => {
  const utilisateur = req.body;
  const defaultRole = 3; // 3 = stagiaire, 2 = validateur, 1 = admin

  bcrypt.hash(utilisateur.password, 10, (err, hash) => {
    connection.query(
      "INSERT INTO users(email, password, role_id) VALUES (?,?,?)",
      [utilisateur.email, hash, defaultRole],
      (err, resultat) => {
        if (err) {
          console.debug(err);
          return res.sendStatus(500);
        }

        res.json({ message: "utilsateur enregistré" });
      }
    );
  });
});

// connexion
app.post("/connexion", (req, res) => {
  const utilisateur = req.body;

  connection.query(
    "SELECT * FROM users WHERE email = ?",
    [utilisateur.email],
    (err, resultat) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }

      if (resultat.length != 1) {
        return res.sendStatus(401);
      }

      bcrypt.compare(
        utilisateur.password,
        resultat[0].password,
        (err, compatible) => {
          if (err) {
            console.debug(err);
            return res.sendStatus(500);
          }

          if (compatible) {
            return res.send(
              jwtUtil.sign({ email: utilisateur.email }, "azerty123")
            );
          }

          return res.sendStatus(401);
        }
      );
    }
  );
});

// crud formation
app.get("/training", jwtParser, (req, res) => {
  connection.query("SELECT * FROM training", (err, trainings) => {
    res.json(trainings);
  });
});

app.get("/training/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  connection.query(
    "SELECT * FROM training WHERE id = ?",
    [id],
    (err, trainings) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }

      if (trainings.length == 0) {
        return res.sendStatus(404);
      }
      res.json(trainings[0]);
    }
  );
});

app.post("/training", jwtParser, upload.single("image"), async (req, res) => {
  const training = req.body;
  const imagePath = req.file
    ? "/upload/" + req.file.filename
    : training.image || null;

  try {
    // Vérifie que l'utilisateur connecté n'est pas un stagiaire
    const [userRows] = await connection
      .promise()
      .query("SELECT role_id FROM users WHERE id = ?", [req.user.id]);

    if (userRows.length === 0) {
      return res.sendStatus(401); // utilisateur inexistant
    }

    const roleId = userRows[0].role_id;

    if (roleId === 3) {
      return res
        .status(403)
        .json({ error: "Les stagiaires ne peuvent pas créer de formations." });
    }

    // Validation des données
    if (
      !training.title ||
      training.title.length < 3 ||
      training.title.length > 50 ||
      !training.start_date ||
      !training.end_date ||
      isNaN(Date.parse(training.start_date)) ||
      isNaN(Date.parse(training.end_date)) ||
      (training.description && training.description.length > 255)
    ) {
      return res.sendStatus(400);
    }

    const startDate = new Date(training.start_date);
    const endDate = new Date(training.end_date);

    if (startDate >= endDate) {
      return res.status(400).json({
        error: "La date de fin doit être après la date de début",
      });
    }

    // Vérifie si une formation avec le même titre existe déjà
    const [existing] = await connection
      .promise()
      .query("SELECT id FROM training WHERE title = ?", [training.title]);

    if (existing.length > 0) {
      return res.sendStatus(409); // Conflit
    }

    // Insertion en base
    const [insertResult] = await connection
      .promise()
      .query(
        "INSERT INTO training (title, description, start_date, end_date, image, utilisateur_id) VALUES (?,?,?,?,?,?)",
        [
          training.title,
          training.description || null,
          training.start_date,
          training.end_date,
          imagePath,
          req.user.id,
        ]
      );

    // Réponse avec la formation créée
    res.status(201).json({
      id: insertResult.insertId,
      ...training,
      image: imagePath,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Erreur lors de la création de la formation." });
  }
});

app.put(
  "/training/:id",
  jwtParser,
  upload.single("image"),
  async (req, res) => {
    const id = req.params.id;
    const training = req.body;
    const existingImage = req.body.existingImage || "";

    try {
      // Récupérer la formation
      const [rows] = await connection
        .promise()
        .query("SELECT * FROM training WHERE id = ?", [id]);

      if (rows.length === 0) {
        return res.sendStatus(404); // Formation non trouvée
      }

      const trainingFromDb = rows[0];
      const oldImagePath = trainingFromDb.image;
      const idCreateur = trainingFromDb.user_id;

      // 👤 Récupération du rôle de l'utilisateur connecté
      const [userRows] = await connection
        .promise()
        .query("SELECT role_id FROM users WHERE id = ?", [req.user.id]);

      if (userRows.length === 0) {
        return res.sendStatus(401); // utilisateur inexistant
      }

      const roleId = userRows[0].role_id;

      // Vérification des droits
      if (
        (roleId === 3 && req.user.id !== idCreateur) || // stagiaire ≠ propriétaire
        (req.user.id !== idCreateur &&
          !(
            req.user.name === "admin" ||
            (req.user.name === "validateur" && req.user.id === idCreateur)
          ))
      ) {
        return res.sendStatus(403); // Interdit
      }

      // Validation des dates
      const startDate = new Date(training.start_date);
      const endDate = new Date(training.end_date);

      if (startDate >= endDate) {
        return res.status(400).json({
          error: "La date de fin doit être après la date de début",
        });
      }

      // Gérer l'image
      let newImagePath = existingImage;

      if (req.file) {
        newImagePath = "/upload/" + req.file.filename;

        if (oldImagePath && oldImagePath !== "/upload/default.png") {
          const fullPath = path.join(__dirname, "public", oldImagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlink(fullPath, (err) => {
              if (err) console.error(`Erreur suppression: ${fullPath}`, err);
              else console.log(`Image supprimée: ${fullPath}`);
            });
          }
        }
      }

      // Mise à jour
      await connection
        .promise()
        .query(
          "UPDATE training SET title = ?, description = ?, start_date = ?, end_date = ?, image = ? WHERE id = ?",
          [
            training.title,
            training.description || null,
            training.start_date,
            training.end_date,
            newImagePath,
            id,
          ]
        );

      res.json({
        id,
        ...training,
        image: newImagePath,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Échec de la mise à jour" });
    }
  }
);

app.delete("/training/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  //on recupère la formation afin de vérifier si le possesseur est bien le propriétaire connecté
  connection.query(
    "SELECT * FROM training WHERE id = ?",
    [id],
    (err, trainings) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }

      //la formation n'existe pas
      if (trainings.length == 0) {
        return res.sendStatus(404);
      }

      const idCreateur = trainings[0].utilisateur_id;

      console.log(idCreateur);
      console.log(req.user);

      //gestion des droits (req.user.nom = colonne nom de la table role)
      //on n'effectue l'opération que si l'utilisateur est administrateur, ou vendeur ET créateur du produit
      if (
        req.user.name == "admin" ||
        (req.user.name == "validateur" && idCreateur == req.user.id)
      ) {
        connection.query(
          "DELETE FROM training WHERE id = ?",
          [id],
          (err, reponse) => {
            if (err) {
              console.debug(err);
              return res.sendStatus(500);
            }

            console.log(reponse);

            return res.sendStatus(204);
          }
        );
      } else {
        return res.sendStatus(401);
      }
    }
  );
});

// routes pour les retards

// GET tous les retards
app.get("/retard", jwtParser, async (req, res) => {
  try {
    // Récupérer le rôle de l'utilisateur connecté
    const [userRows] = await connection
      .promise()
      .query("SELECT role_id FROM users WHERE id = ?", [req.user.id]);

    if (userRows.length === 0) return res.sendStatus(401);

    const roleId = userRows[0].role_id;

    let query = `
      SELECT lateness.*, users.email as user_email
      FROM lateness
      LEFT JOIN users ON users.id = lateness.user_id
    `;
    let params = [];

    // Si stagiaire → filtrer ses propres retards
    if (roleId === 3) {
      query += " WHERE lateness.user_id = ?";
      params.push(req.user.id);
    }

    const [retards] = await connection.promise().query(query, params);

    res.json(retards);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// GET un retard par id
app.get("/retard/:id", jwtParser, (req, res) => {
  connection.query(
    "SELECT * FROM lateness WHERE id = ?",
    [req.params.id],
    (err, retards) => {
      if (err) return res.sendStatus(500);
      if (retards.length === 0) return res.sendStatus(404);
      res.json(retards[0]);
    }
  );
});

// POST ajout d’un retard
app.post("/retard", jwtParser, (req, res) => {
  const { date_lateness, duration, user_id } = req.body; // Destructuring

  if (!date_lateness || !duration || !user_id) return res.sendStatus(400);

  connection.query(
    "SELECT role_id FROM users WHERE id = ?",
    [user_id],
    (err, results) => {
      if (err) return res.sendStatus(500);
      if (results.length === 0) return res.sendStatus(404);

      const roleId = results[0].role_id; // Accès correct au premier résultat

      if (roleId !== 3) {
        return res.status(400).json({
          error: "Seuls les stagiaires peuvent avoir des retards déclarés",
        });
      }

      // Insertion avec les variables définies
      connection.query(
        "INSERT INTO lateness (date_lateness, duration, user_id) VALUES (?,?,?)",
        [date_lateness, duration, user_id],
        (err, result) => {
          if (err) return res.sendStatus(500);
          res.json({ id: result.insertId, ...req.body });
        }
      );
    }
  );
});

// PUT modification d’un retard
app.put("/retard/:id", jwtParser, async (req, res) => {
  const id = req.params.id;
  let { date_lateness, duration, user_id } = req.body;

  // Vérification des champs requis (user_id sera éventuellement remplacé + validé ensuite)
  if (!date_lateness || !duration) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }

  try {
    //  Récupérer l'ancien retard
    const [retardRows] = await connection
      .promise()
      .query("SELECT * FROM lateness WHERE id = ?", [id]);

    if (retardRows.length === 0) return res.sendStatus(404);

    const retard = retardRows[0];

    //  Récupération du rôle de l'utilisateur connecté
    const [userRows] = await connection
      .promise()
      .query("SELECT role_id FROM users WHERE id = ?", [req.user.id]);

    if (userRows.length === 0) return res.sendStatus(401);

    const roleId = userRows[0].role_id;

    //  Droits de modification
    const isOwner = req.user.id === retard.user_id;
    const isAdmin = req.user.name === "admin";
    const isValidator = req.user.name === "validateur" && isOwner;

    if (!isOwner && !isAdmin && !isValidator) {
      return res.sendStatus(403);
    }

    //  Si stagiaire, forcer le user_id à son propre ID
    if (roleId === 3) {
      user_id = req.user.id;
    }

    // Vérifier que le user_id est bien un stagiaire
    const [targetUserRows] = await connection
      .promise()
      .query("SELECT role_id FROM users WHERE id = ?", [user_id]);

    if (targetUserRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur cible non trouvé" });
    }

    if (targetUserRows[0].role_id !== 3) {
      return res.status(400).json({
        error: "Seuls les stagiaires peuvent avoir des retards déclarés",
      });
    }

    // Mise à jour
    const [updateResult] = await connection
      .promise()
      .query(
        "UPDATE lateness SET date_lateness = ?, duration = ?, user_id = ? WHERE id = ?",
        [date_lateness, duration, user_id, id]
      );

    if (updateResult.affectedRows === 0) {
      return res.sendStatus(404);
    }

    res.json({ id, date_lateness, duration, user_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour" });
  }
});

// DELETE suppression d’un retard (admin/validateur uniquement)
app.delete("/retard/:id", jwtParser, (req, res) => {
  const id = req.params.id;
  connection.query(
    "SELECT * FROM lateness WHERE id = ?",
    [id],
    (err, lateness) => {
      if (err) return res.sendStatus(500);
      if (lateness.length === 0) return res.sendStatus(404);

      const idCreateur = lateness[0].user_id;
      if (
        req.user.name === "admin" ||
        (req.user.name === "validateur" && idCreateur === req.user.id)
      ) {
        connection.query("DELETE FROM lateness WHERE id = ?", [id], (err) => {
          if (err) return res.sendStatus(500);
          return res.sendStatus(204);
        });
      } else {
        return res.sendStatus(401);
      }
    }
  );
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
