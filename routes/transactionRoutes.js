import express from 'express';
import Transaction from '../models/Transaction.js';
import {  authorize, protect, protectUser } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Route pour ajouter une transaction
router.post('/', protect, async (req, res) => {
  const { amount, reason, userId, type, subtype,donateur } = req.body; // Inclure subtype


  if (!['entrée', 'sortie'].includes(type)) {
    return res.status(400).json({ message: 'Invalid transaction type' });
  }

  const transaction = new Transaction({
    amount,
    reason,
    initiatedBy: userId,
    type,
    donateur,
    subtype, // Inclure subtype ici
  });

  await transaction.save();
  res.status(201).json(transaction);
});

// Route pour que le trésorier valide la transaction
// Route pour qu'un trésorier valide une transaction
router.put('/validate-treasurer/:id', protect, authorize(['tresorier']), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Vérifiez si la transaction est déjà validée par un trésorier
    if (transaction.validatedByTreasurers) {
      return res.status(400).json({ message: 'Transaction already validated by a treasurer' });
    }

    // Ajouter l'ID du trésorier validant
    transaction.validatedByTreasurers = req.user.id;
    await transaction.save();

    res.json({ message: 'Transaction validated successfully', transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to validate transaction' });
  }
});


router.put('/reject-treasurer/:id', protect, authorize(['tresorier']), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Vérifiez si la transaction est déjà rejetée par un trésorier
    if (transaction.rejectedByTreasurers) {
      return res.status(400).json({ message: 'Transaction already rejected by a treasurer' });
    }

    // Ajouter l'ID du trésorier rejetant
    transaction.rejectedByTreasurers = req.user.id;
    await transaction.save();

    res.json({ message: 'Transaction rejected successfully', transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to reject transaction' });
  }
});


// Route pour récupérer toutes les transactions "sortie" non validées
router.get('/pending-expenses', protect, authorize(['president', 'PCO']), async (req, res) => {
  try {
    const pendingExpenses = await Transaction.find({
      type: 'sortie',
      validatedByPresidentAndPCO: false,
    }).populate('initiatedBy', 'username ');

    res.status(200).json(pendingExpenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch pending expenses.' });
  }
});

// Route pour que le président et contrôleur valident la sortie d'argent
// Route pour que le président et contrôleur valident la sortie d'argent
router.put('/validate/:id', protect, authorize(['president', 'PCO']), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction introuvable.' });
    }

    if (req.user.role === 'president') {
      if (transaction.validatedByPresident) {
        return res.status(400).json({ message: 'Transaction déjà validée par le président.' });
      }
      transaction.validatedByPresident = true;
    } else if (req.user.role === 'PCO') {
      if (transaction.validatedByPCO) {
        return res.status(400).json({ message: 'Transaction déjà validée par le PCO.' });
      }
      transaction.validatedByPCO = true;
    }

    if (transaction.validatedByPresident && transaction.validatedByPCO) {
      transaction.validatedByPresidentAndPCO = true;
    }

    await transaction.save();

    res.status(200).json({
      message: 'Transaction validée avec succès.',
      transaction,
    });
  } catch (error) {
    console.error('Erreur lors de la validation de la transaction :', error);
    res.status(500).json({ message: 'Échec de la validation de la transaction.' });
  }
});




// Route pour récupérer toutes les transactions
router.get('/entree/:userId', protectUser, async (req, res) => {
  const { userId } = req.params;

  try {
    // Trouve l'utilisateur (trésorier) par son userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Trouve les transactions de type "entrée" validées par un trésorier
    const transactions = await Transaction.find({
      initiatedBy: userId,
      type: 'entrée',
      validatedByTreasurers: { $exists: true }, // Vérifie que le champ existe et a une valeur
    }).sort({ date: -1 })
      .populate('validatedByTreasurers', 'username'); // Peupler avec le username du trésorier

    // Ajoute les usernames des trésoriers à chaque transaction
    const transactionsWithTreasurers = transactions.map(transaction => {
      return {
        ...transaction._doc,
        treasurerUsername: transaction.validatedByTreasurers?.username, // Username du trésorier
      };
    });

    res.status(200).json(transactionsWithTreasurers);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions.' });
  }
});




router.get('/', protect, async (req, res) => {
  try {
    const { type, price, reason, date } = req.query;

    // Base query sans restriction par utilisateur
    let query = {};

    if (type === 'sortie') {
      query = {
        ...query,
        type: 'sortie',
        validatedByPresidentAndPCO: true, // Vérifie la validation combinée
      };
    } else if (type === 'entrée') {
      query = {
        ...query,
        type: 'entrée',
        validatedByTreasurers: { $exists: true }, // Valide si une personne a approuvé
        rejectedByTreasurers: { $exists: false }, // Rejeté si non défini
      };
    }

    // Filtrage par prix, raison, et date
    if (price) {
      query.amount = parseFloat(price);
    }

    if (reason) {
      query.reason = { $regex: reason, $options: 'i' }; // Filtre insensible à la casse
    }

    if (date) {
      query.date = { $regex: date }; // Filtre par date
    }

    // Récupérer les transactions avec les détails de l'utilisateur
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate('initiatedBy', 'username'); // Inclure le nom de l'utilisateur

    res.json(transactions);
  } catch (error) {
    console.error('Erreur lors de la récupération des transactions :', error);
    res.status(500).json({ message: 'Échec de la récupération des transactions' });
  }
});


router.get('/leaderboard', async (req, res) => { 
  try {
    const leaderboard = await Transaction.aggregate([
      { 
        $match: { 
          type: 'entrée', 
          validatedByTreasurers: { $exists: true, $ne: null } // Entrées validées seulement
        } 
      },
      {
        $group: {
          _id: '$initiatedBy', // Grouper par l'utilisateur ayant initié
          totalFunds: { $sum: '$amount' }, // Somme des montants collectés
        },
      },
      {
        $lookup: {
          from: 'users', // Jointure avec la collection des utilisateurs
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' }, // Transformer le tableau `user` en un objet unique
      { $match: { 'user.role': 'user' } }, // Inclure uniquement les utilisateurs avec le rôle `user`
      { $sort: { totalFunds: -1 } }, // Trier par montant décroissant
      { $project: { _id: 1, totalFunds: 1, 'user.username': 1 } }, // Sélectionner uniquement les champs nécessaires
    ]);

    res.json(leaderboard);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement :', error);
    res.status(500).json({ message: 'Échec de la récupération du classement' });
  }
});




// Nouvelle route pour récupérer les transactions "entrée" d'un utilisateur
router.get('/entree/:userId', protect, async (req, res) => {
  const { userId } = req.params;

  try {
    // Trouve les transactions de type "entrée" validées par au moins un trésorier
    const transactions = await Transaction.find({
      initiatedBy: userId,
      type: 'entrée',
      validatedByTreasurers: { $exists: true, $ne: [] }, // Vérifie que le tableau contient au moins un élément
    }).sort({ date: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions.' });
  }
});





// Route pour récupérer les transactions non validées par les trésoriers
router.get('/pending-treasurer', protect, authorize(['tresorier']), async (req, res) => {
  try {
    // Récupérer les transactions de type 'entrée' qui ne sont pas validées ni rejetées par le trésorier
    const pendingTransactions = await Transaction.find({
      type: 'entrée', // Type 'entrée'
      $and: [
        { validatedByTreasurers: { $exists: false } }, // Non validées
        { rejectedByTreasurers: { $exists: false } }  // Non rejetées
      ]
    }).sort({ date: -1 });

    res.json(pendingTransactions);
  } catch (error) {
    console.error('Erreur lors de la récupération des transactions en attente :', error);
    res.status(500).json({ message: 'Échec de la récupération des transactions en attente' });
  }
});


router.post('/create-expense', protect, authorize(['tresorier']), async (req, res) => {
  const { amount, reason, beneficiary } = req.body;

  if (!amount || !reason || !beneficiary) {
    return res.status(400).json({ message: 'Amount, reason, and beneficiary are required.' });
  }

  try {
    const transaction = new Transaction({
      amount,
      reason,
      type: 'sortie',
      initiatedBy: req.user.id, // ID du trésorier qui a initié
      donateur: beneficiary, // La personne ou entreprise qui recevra les fonds
    });

    await transaction.save();
    res.status(201).json({ message: 'Depense effectuer', transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Echec de la transaction.' });
  }
});


export default router;
