import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { expiresIn } = req.body;

  let signOptions = {};

  if (expiresIn === 0 || expiresIn === 'never') {
    signOptions = {};
  } else if (typeof expiresIn === 'number') {
    signOptions = { expiresIn: `${expiresIn}s` };
  } else if (typeof expiresIn === 'string') {
    signOptions = { expiresIn };
  } else {
    signOptions = { expiresIn: '1h' };
  }

  const token = jwt.sign(
    { created: Date.now() },
    SECRET_KEY,
    signOptions
  );

  res.status(200).json({ token, expiresIn: signOptions.expiresIn || 'never' });
}
