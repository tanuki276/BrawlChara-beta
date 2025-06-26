import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const CHARACTER_PATH = path.join(__dirname, 'character.json');

app.use('/public', express.static(path.join(__dirname, 'icons')));
app.use(express.json());

app.post('/api/token', (req, res) => {
  const { expiresIn } = req.body;
  let expires;
  if (expiresIn === 'never' || expiresIn === 0) {
    expires = '100y';
  } else if (typeof expiresIn === 'string') {
    expires = expiresIn;
  } else if (typeof expiresIn === 'number') {
    expires = `${expiresIn}s`;
  } else {
    expires = '1h';
  }

  const token = jwt.sign({ created: Date.now() }, SECRET_KEY, { expiresIn: expires });
  res.json({ token, expiresIn: expires });
});

async function translateText(text, target) {
  if (target === 'ja') return text;
  const encodedText = encodeURIComponent(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=ja|${target}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.error('Translation API error:', e);
  }
  return text;
}

app.get('/api/character', async (req, res) => {
  const { token, lang = 'ja', rarity, role, count = 1, blockedIds } = req.query;

  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    jwt.verify(token, SECRET_KEY);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const charactersRaw = fs.readFileSync(CHARACTER_PATH, 'utf8');
    let characters = JSON.parse(charactersRaw);

    let parsedBlockedIds = [];
    if (blockedIds) {
      parsedBlockedIds = blockedIds.split(',').map(id => id.trim()).filter(id => id !== '');
    }

    let filteredCharacters = characters;

    if (rarity) {
      const decodedRarity = decodeURIComponent(rarity);
      filteredCharacters = filteredCharacters.filter(char => char.rarity === decodedRarity);
    }

    if (role) {
      const decodedRole = decodeURIComponent(role);
      filteredCharacters = filteredCharacters.filter(char => char.role === decodedRole);
    }

    if (parsedBlockedIds.length > 0) {
      filteredCharacters = filteredCharacters.filter(char => !parsedBlockedIds.includes(char.id));
    }

    if (filteredCharacters.length === 0) {
      res.status(404).json({ error: 'No characters found with the specified criteria after filtering and blocking.' });
      return;
    }

    const numToRetrieve = Math.max(1, Math.min(parseInt(count, 10) || 1, filteredCharacters.length));

    const selectedCharacters = [];
    for (let i = 0; i < numToRetrieve; i++) {
      const randomIndex = Math.floor(Math.random() * filteredCharacters.length);
      selectedCharacters.push(filteredCharacters.splice(randomIndex, 1)[0]);
    }

    const results = await Promise.all(selectedCharacters.map(async (char) => {
      const translatedRarity = await translateText(char.rarity, lang);
      const translatedRole = await translateText(char.role, lang);
      return {
        name: char.name,
        rarity: translatedRarity,
        role: translatedRole,
      };
    }));

    if (results.length === 1) {
      res.json(results[0]);
    } else {
      res.json(results);
    }

  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/cookie', async (req, res) => {
  const { consent, timestamp } = req.body;

  if (!process.env.DISCORD_WEBHOOK_URL) {
    return res.status(500).json({ error: 'サーバー設定エラー: 送信処理が設定されていません' });
  }

  if (consent !== 'accepted' || !timestamp) {
    return res.status(400).json({ error: '無効な同意情報です。' });
  }

  const discordMessage = {
    embeds: [
      {
        title: "クッキー同意通知",
        description: "ユーザーがクッキーに同意しました。",
        color: 5763719,
        fields: [
          { name: "同意状況", value: "同意済み", inline: true },
          { name: "タイムスタンプ", value: new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }), inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Brawlchara Cookie Consent" }
      }
    ]
  };

  try {
    const discordRes = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
    });

    if (!discordRes.ok) {
      return res.status(500).json({ error: 'Discordへの送信に失敗しました。' });
    }

    res.status(200).json({ message: '同意情報を受け付けました。' });
  } catch {
    res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
});

export default app;