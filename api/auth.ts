type LoginResponse = {
  success: boolean;
  data?: {
    token?: string;
    user?: {
      id: number;
      email: string;
      username: string;
    };
  };
  error?: string;
};

export type LoggedInUser = {
  id: number;
  email: string;
  username: string;
};

export async function loginUser(
  email: string,
  password: string
): Promise<{
  token: string;
  user: LoggedInUser;
}> {
  const response = await fetch(
    'https://dataworks-7b7x.onrender.com/api/login-api.php',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        pw: password,
      }),
    }
  );

  const data: LoginResponse =
    await response.json();

  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.error ??
        'Failed to log in.'
    );
  }

  const token =
    data.data?.token;

  const user =
    data.data?.user;

  if (!token || !user) {
    throw new Error(
      'The server did not return valid login information.'
    );
  }

  return {
    token,
    user,
  };
}