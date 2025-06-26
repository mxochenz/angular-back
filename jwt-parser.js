const jwtUtil = require("jsonwebtoken");
const connection = require("./connection-db");

function auth(req, res, next) {
  const jwtToken = req.headers["authorization"];
  if (!jwtToken) {
    return res.status(401).json({ message: "Non autorisé" });
  }
  jwtUtil.verify(jwtToken, "azerty123", (err, decoded) => {
    const email = decoded.email;

    connection.query(
      "SELECT u.id, u.email, r.name FROM users u " +
        "JOIN role r ON u.role_id = r.id " +
        "WHERE email = ?",
      [email],
      (err, lignes) => {
        if (err) {
          console.log(err);
          res.status(500);
        }
        //cas particulier où la personne a été supprimée depuis qu'on lui a donné son JWT
        if (lignes.length == 0) {
          res.status(401);
        }

        //on affecte à une nouvelle propriété "user" l'objet issu de la requete SQL
        //donc toutes les colonnes de la table utilisateur sont dans les propriétés de req.user
        req.user = lignes[0];
        next();
      }
    );

    if (err) {
      return res.status(401).json({ message: "Non autorisé" });
    }
  });
}

module.exports = auth;
