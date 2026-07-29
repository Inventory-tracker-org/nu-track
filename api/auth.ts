type LoginResponse = {
  success: boolean;
  data?: {
    token?: string;
  };
  token?: string;
  error?: string;
};

export async function loginUser(
  email: string,
  password: string
): Promise<string> {

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

  const data: LoginResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? 'Failed to log in.');
  }

  const token = data.data?.token ?? data.token;

  if (!token) {
    throw new Error('The server did not return a token.');
  }

  return token;
}