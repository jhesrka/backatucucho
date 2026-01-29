import { compareSync, genSaltSync, hashSync } from "bcryptjs";

export const encriptAdapter = {
  hash: (password: string) => {
    const salt = genSaltSync(12);
    return hashSync(password, salt);
  },
  compare: (unHashedPassword: string, hashedPassword: string) => {
    try {
      if (typeof unHashedPassword !== 'string' || typeof hashedPassword !== 'string') {
        console.error('Bcrypt Error: Invalid arguments. Both must be strings.');
        return false;
      }
      return compareSync(unHashedPassword, hashedPassword);
    } catch (error) {
      console.error('Bcrypt Error:', error);
      return false;
    }
  },
};
