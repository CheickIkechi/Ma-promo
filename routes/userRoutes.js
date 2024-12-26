import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Log des données reçues

  // Recherche de l'utilisateur dans la base de données
  const user = await User.findOne({ username });

  // Vérification du mot de passe
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'username ou mot de passe incorrect' });
  }
});

// Route pour créer un utilisateur
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  const userExists = await User.findOne({ username });

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = new User({
    username,
    password,
    role,
  });

  await user.save();

  res.status(201).json({ message: 'User created successfully' });
});

// Route pour l'authentification

// Route pour modifier le mot de passe
router.put('/change-password', protect, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  if (user && (await user.matchPassword(oldPassword))) {
    user.password = newPassword; // Mettre à jour le mot de passe
    await user.save();
    res.json({ message: 'mot de pass mise a jour' });
  } else {
    res.status(401).json({ message: 'Ancien mot de pass incorrect' });
  }
});



export default router;
