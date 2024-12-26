import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  reason: { type: String },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  donateur: { type: String },
  type: {
    type: String,
    enum: ['entrée', 'sortie'],
    required: true,
  },
  subtype: {
    type: String,
    enum: ['cotisation', 'collect'], 
    required: function () { return this.type === 'entrée'; }
  },
  validatedByTreasurers: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedByTreasurers: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Nouveau champ pour les rejets  
  validatedByPresident: { type: Boolean, default: false }, // Validation par le président
  validatedByPCO: { type: Boolean, default: false }, // Validation par le contrôleur
  validatedByPresidentAndPCO: { type: Boolean, default: false }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;