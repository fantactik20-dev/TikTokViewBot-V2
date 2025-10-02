const axios = require('axios');
const fs = require('fs');
const readline = require('readline-sync');
const crypto = require('crypto');

let reqs = 0, success = 0, fails = 0;
let rps = 0, rpm = 0;

const devices = fs.existsSync('devices.txt') ? fs.readFileSync('devices.txt', 'utf-8').split('\n').filter(Boolean) : [];
const proxies = fs.existsSync('proxies.txt') ? fs.readFileSync('proxies.txt', 'utf-8').split('\n').filter(Boolean) : [];
const config = fs.existsSync('config.json') ? JSON.parse(fs.readFileSync('config.json', 'utf-8')) : {
  proxy: {
    use_proxy: false,
    'proxy-type': 'http',
    auth: false,
    credential: ''
  }
};

function gorgon(params, data, cookies, unix) {
  function md5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
  }
  let baseStr = md5(params) + (data ? md5(data) : '0'.repeat(32)) + (cookies ? md5(cookies) : '0'.repeat(32));
  return {
    'X-Gorgon': '0404b0d300000000000000000000000000000000',
    'X-Khronos': unix.toString()
  };
}

async function send(did, iid, cdid, openudid, aweme_id) {
  try {
    const params = `device_id=${did}&iid=${iid}&device_type=SM-G973N&app_name=musically_go&host_abi=armeabi-v7a&channel=googleplay&device_platform=android&version_code=160904&device_brand=samsung&os_version=9&aid=1340`;
    const payload = `item_id=${aweme_id}&play_delta=1`;
    const sig = gorgon(params, null, null, Math.floor(Date.now() / 1000));
    const proxyUrl = config.proxy.use_proxy ? proxies[Math.floor(Math.random() * proxies.length)] : null;
    const axiosConfig = {
      method: 'post',
      url: `https://api16-va.tiktokv.com/aweme/v1/aweme/stats/?${params}`,
      data: payload,
      headers: {
        'cookie': 'sessionid=90c38a59d8076ea0fbc01c8643efbe47',
        'x-gorgon': sig['X-Gorgon'],
        'x-khronos': sig['X-Khronos'],
        'user-agent': 'okhttp/3.10.0.1'
      },
      timeout: 5000,
      httpsAgent: undefined,
      proxy: false
    };

    if (proxyUrl) {
      const tunnel = require('tunnel');
      const proxyParts = new URL(proxyUrl);
      axiosConfig.httpsAgent = tunnel.httpsOverHttp({
        proxy: {
          host: proxyParts.hostname,
          port: parseInt(proxyParts.port),
          proxyAuth: proxyParts.username ? `${proxyParts.username}:${proxyParts.password}` : undefined,
        }
      });
      axiosConfig.proxy = false;
    }

    const response = await axios(axiosConfig);
    reqs++;
    if (response.data && response.data.log_pb && response.data.log_pb.impr_id) {
      success++;
      console.log(`✅ sent views ${response.data.log_pb.impr_id} ${aweme_id} | reqs: ${reqs}`);
    } else {
      fails++;
    }
  } catch (e) {
    fails++;
  }
}

async function sendBatch(batchDevices, aweme_id) {
  await Promise.all(batchDevices.map(device => {
    const [did, iid, cdid, openudid] = device.split(':');
    return send(did, iid, cdid, openudid, aweme_id);
  }));
}

function statsLoop() {
  let lastReqs = reqs;
  setInterval(() => {
    rps = ((reqs - lastReqs) / 1.5).toFixed(1);
    rpm = (rps * 60).toFixed(1);
    lastReqs = reqs;
    process.title = `TikTok Viewbot | success: ${success} fails: ${fails} reqs: ${reqs} rps: ${rps} rpm: ${rpm}`;
  }, 1500);
}

async function main() {
  console.clear();
  console.log(`
╦  ╦╦╔═╗╦ ╦╔╗ ╔═╗╔╦╗
╚╗╔╝║║╣ ║║║╠╩╗║ ║ ║ 
 ╚╝ ╩╚═╝╚╩╝╚═╝╚═╝ ╩ 
  `);

  const link = readline.question('? - Video Link > ');
  const idMatch = link.match(/\d{18,19}/g);
  if (!idMatch) {
    console.log('x - Invalid link, try inputting video id only');
    process.exit(0);
  }
  const aweme_id = idMatch[0];

  if (devices.length === 0) {
    console.log('x - devices.txt is empty or missing!');
    process.exit(1);
  }

  statsLoop();

  const concurrency = 350;

  while (true) {
    const batchDevices = [];
    for (let i = 0; i < concurrency; i++) {
      batchDevices.push(devices[Math.floor(Math.random() * devices.length)]);
    }
    await sendBatch(batchDevices, aweme_id);
  }
}

main();
