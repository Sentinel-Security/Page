require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Sirve archivos desde la raíz

// Configuración de Discord OAuth
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; // ID de tu servidor de Discord

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta de callback de Discord OAuth
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Intercambiar código por token de acceso
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Obtener información del usuario
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const user = userResponse.data;

    // Obtener roles del usuario en el servidor
    let roles = [];
    try {
      const memberResponse = await axios.get(
        `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      
      const roleIds = memberResponse.data.roles;

      // Obtener información de los roles del servidor
      const guildResponse = await axios.get(
        `https://discord.com/api/guilds/${GUILD_ID}/roles`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      const guildRoles = guildResponse.data;
      roles = roleIds
        .map(roleId => {
          const role = guildRoles.find(r => r.id === roleId);
          return role ? role.name : null;
        })
        .filter(name => name !== null);
    } catch (error) {
      console.error('Error obteniendo roles:', error.message);
    }

    // Redirigir con datos del usuario
    const userData = {
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`,
      roles: roles,
    };

    res.redirect(`/?user=${encodeURIComponent(JSON.stringify(userData))}`);
  } catch (error) {
    console.error('Error en OAuth:', error.response?.data || error.message);
    res.redirect('/?error=auth_failed');
  }
});

// API para verificar roles (opcional)
app.post('/api/verify-role', async (req, res) => {
  const { roles, requiredRole } = req.body;
  
  if (!roles || !requiredRole) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const hasRole = roles.includes(requiredRole);
  res.json({ hasRole });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📝 Discord OAuth configurado`);
});
