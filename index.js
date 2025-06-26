const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwtUtil = require("jsonwebtoken");
const app = express();
const jwtParser = require("./jwt-parser");
const connection = require("./connection-db");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("hello");
});

app.post("/inscription", (req, res) => {
  const utilisateur = req.body;
  const defaultRole = 1; // 1 = stagiaire, 2 = validateur, 3 = admin

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

app.get("/training", jwtParser, (req, res) => {
  connection.query("SELECT * FROM training", (err, trainings) => {
    res.json(trainings);
  });
});

app.get("/training/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  connection.query(
    "SELECT * FROM training WHERE training_id = ?",
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

app.post("/training", jwtParser, (req, res) => {
  const training = req.body;

  if (
    training.name == null ||
    training.name.length < 3 ||
    training.name.length > 50 ||
    (training.description && training.description.length > 255)
  ) {
    return res.sendStatus(400); //bad request
  }

  connection.query(
    "SELECT * FROM training WHERE name = ?",
    [training.name],
    (err, lignes) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }

      //une formation porte déjà le nom saisi
      if (lignes.length >= 1) {
        return res.sendStatus(409); //conflict
      }

      connection.query(
        "INSERT INTO training (name, description, utilisateur_id) VALUES (?,?,?)",
        [training.name, training.description, req.user.id],
        (err, lignes) => {
          if (err) {
            console.log(err);
            return res.sendStatus(500);
          }

          res.json(training);
        }
      );
    }
  );
});

app.put("/training/:id", jwtParser, (req, res) => {
  const id = req.params.id;
  const training = req.body;
  training.id = id;

  //validation des données
  if (
    training.name == null ||
    training.name.length < 3 ||
    training.name.length > 50 ||
    (training.description && training.description.length > 255)
  ) {
    return res.sendStatus(400); //bad request
  }

  connection.query(
    "SELECT * FROM training WHERE name = ? AND training_id != ?",
    [training.name, id],
    (err, lignes) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }

      //une formation porte déjà le nom saisi
      if (lignes.length >= 1) {
        return res.sendStatus(409); //conflict
      }

      connection.query(
        "UPDATE training SET name = ?, description = ? WHERE training_id = ?",
        [training.name, training.description, id],
        (err, lignes) => {
          console.log(lignes);

          if (err) {
            console.log(err);
            return res.sendStatus(500);
          }

          res.json(training);
        }
      );
    }
  );
});

app.delete("/training/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  //on recupère la formation afin de vérifier si le possesseur est bien le propriétaire connecté
  connection.query(
    "SELECT * FROM training WHERE training_id = ?",
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
          "DELETE FROM training WHERE training_id = ?",
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

// recupération de tous les retards
// on utilise jwtParser pour vérifier que l'utilisateur est connecté
// et qu'il a les droits nécessaires pour accéder à cette ressource
app.get("/retard", jwtParser, (req, res) => {
  connection.query("SELECT * FROM lateness", (err, retards) => {
    res.json(retards);
  });
});

// recupération d'un retard par son id
app.get("/retard/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  connection.query(
    "SELECT * FROM retard WHERE id = ?",
    [id],
    (err, retards) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }

      if (retards.length == 0) {
        return res.sendStatus(404);
      }
      res.json(retards[0]);
    }
  );
});

// ajout d'un retard
app.post("/retard", jwtParser, (req, res) => {
  const retard = req.body;

  connection.query(
    "INSERT INTO lateness (date_lateness, duration, user_id) VALUES (?,?,?)",
    [retard.date_retard, retard.duration, retard.user_id],
    (err, reponse) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }
      res.json(retard);
    }
  );
});

// suppression d'un retard par son id
app.delete("/retard/:id", jwtParser, (req, res) => {
  const id = req.params.id;

  connection.query(
    "SELECT * FROM lateness WHERE id = ?",
    [id],
    (err, lateness) => {
      if (err) {
        console.debug(err);
        return res.sendStatus(500);
      }

      //le retard n'existe pas
      if (lateness.length == 0) {
        return res.sendStatus(404);
      }

      const idCreateur = lateness[0].user_id;

      //gestion des droits (req.user.nom = colonne nom de la table role)
      //on n'effectue l'opération que si l'utilisateur est administrateur ou validateur
      if (
        req.user.name == "admin" ||
        (req.user.name == "validateur" && idCreateur == req.user.id)
      ) {
        connection.query(
          "DELETE FROM lateness WHERE id = ?",
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

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
