import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const CHARACTER_PATH = path.join(process.cwd(), 'character.json');

export default async function handler(req, res) {
const { token } = req.query;

if (!token) {
res.status(400).json({ error: 'Token is required' });
return;
}

try {
jwt.verify(token, SECRET_KEY);
} catch (e) {
res.status(401).json({ error: 'Invalid or expired token' });
return;
}

try {
const charactersRaw = fs.readFileSync(CHARACTER_PATH, 'utf8');
const characters = JSON.parse(charactersRaw);
const character = characters[Math.floor(Math.random() * characters.length)];

res.status(200).json({  
  name: character.name,  
  rarity: character.rarity,  
  role: character.role,  
});

} catch (err) {
console.error('Error reading or parsing character.json:', err);
res.status(500).json({ error: 'Internal Server Error' });
}
}
