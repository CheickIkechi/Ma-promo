import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  try {
    // Vérifiez si l'en-tête Authorization est défini et contient le token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1]; // Récupération du token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Décodage du token
      req.user = await User.findById(decoded.id).select('-password'); // Attachez l'utilisateur à req.user
      return next(); // Continuez
    }

    throw new Error('Authorization header missing or invalid');
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const protectUser = async (req, res, next) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'ID utilisateur manquant' });
  }

  try {
    // Vérifiez si l'utilisateur existe dans la base de données
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    req.user = user; // Ajoute l'utilisateur au `req.user`
    next();
  } catch (error) {
    console.error('Failed to validate user ID:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

export { protect, authorize,protectUser };
