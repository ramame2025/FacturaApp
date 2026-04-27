const USERS = [
  {
    id: "1",
    username: "admin",
    password: "admin123",
    nombre: "Administrador",
    role: "admin",
  },
  {
    id: "2",
    username: "juan",
    password: "juan123",
    nombre: "Juan García",
    role: "user",
  },
  {
    id: "3",
    username: "maria",
    password: "maria123",
    nombre: "María López",
    role: "user",
  },
  {
    id: "4",
    username: "carlos",
    password: "carlos123",
    nombre: "Carlos Rodríguez",
    role: "user",
  },
];

export const getAllUsers = () =>
  USERS.map((u) => ({
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    role: u.role,
  }));

export const authenticate = (username, password) => {
  const user = USERS.find((u) => u.username === username && u.password === password);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    role: user.role,
  };
};
