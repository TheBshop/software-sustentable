import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../../middleware/auth.js';

// Los usuarios no usan tenantPlugin: el login busca por email sin saber todavía la
// organización. Toda consulta de usuarios dentro de la API filtra por `organizacion`.
const userSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    organizacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    rol: { type: String, enum: ROLES, default: 'chofer' },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 10);

export const User = mongoose.model('User', userSchema);
