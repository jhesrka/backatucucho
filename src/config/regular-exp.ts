export const regularExp = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&_])[A-Za-z\d@$!%*?#&_]{8,}$/,
  phone: /^\d{10}$/,
  date: /^\d{4}-\d{2}-\d{2}$/, // Formato YYYY-MM-DD
  uuid:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  cedula: /^\d{10}$/,
};
