import UserModel from '../models/User';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  password: string;
}

export interface CreateUserInput {
  email: string;
  name?: string | null;
  password: string;
}


export async function findUserByEmail(email: string): Promise<AuthUser | null> {

  const user = await UserModel.findOne({ email }).exec();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password: user.password,
  };

}

export async function createUser(data: CreateUserInput): Promise<AuthUser> {

  const user = await UserModel.create({
    email: data.email,
    name: data.name,
    password: data.password,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password: user.password,
  };

}

export function toPublicUser(user: AuthUser): Omit<AuthUser, 'password'> {
  const { id, email, name } = user;
  return { id, email, name };
}
