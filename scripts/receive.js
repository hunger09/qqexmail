import Imap from 'imap';
import { simpleParser } from 'mailparser';

const account = process.env.EXMAIL_ACCOUNT;
const authCode = process.env.EXMAIL_AUTH_CODE;

if (!account || !authCode) {
  console.error('请设置环境变量 EXMAIL_ACCOUNT 和 EXMAIL_AUTH_CODE');
  process.exit(1);
}
const imap = new Imap({
  user: account,
  password: authCode,
  host: 'imap.exmail.qq.com',
  port: 993,
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000,
});

function getPreview(text, maxLen = 200) {
  if (!text || typeof text !== 'string') return '';
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= maxLen ? oneLine : oneLine.slice(0, maxLen) + '…';
}

imap.once('ready', () => {
  imap.openBox('INBOX', false, (err, box) => {
    if (err) {
      console.error('打开收件箱失败:', err);
      imap.end();
      return;
    }
    
    console.log(`收件箱中有 ${box.messages.total} 封邮件`);
    
    if (box.messages.total === 0) {
      console.log('暂无邮件');
      imap.end();
      return;
    }
    
    // 获取最近5封邮件
    const limit = Math.min(5, box.messages.total);
    const fetch = imap.seq.fetch(`${box.messages.total - limit + 1}:${box.messages.total}`, { bodies: '' });
    const emails = [];
    
    fetch.on('message', (msg, seqno) => {
      let uid;
      msg.once('attributes', (attrs) => {
        uid = attrs.uid;
      });
      
      msg.on('body', (stream) => {
        simpleParser(stream, (err, parsed) => {
          if (err) {
            console.error('解析邮件失败:', err);
            return;
          }
          emails.push({ parsed, uid, seqno });
        });
      });
    });
    
    fetch.once('error', (err) => {
      console.error('获取邮件失败:', err);
      imap.end();
    });
    
    fetch.once('end', () => {
      console.log(`获取到 ${emails.length} 封邮件\n`);
      
      // 按日期倒序
      emails.sort((a, b) => {
        const da = a.parsed.date ? new Date(a.parsed.date).getTime() : 0;
        const db = b.parsed.date ? new Date(b.parsed.date).getTime() : 0;
        return db - da;
      });
      
      emails.forEach((item, i) => {
        const e = item.parsed;
        const from = e.from?.text || e.from?.value?.[0]?.address || '';
        const date = e.date ? new Date(e.date).toLocaleString() : '';
        const preview = getPreview(e.text || e.html);
        
        console.log(`--- ${i + 1} ---`);
        console.log('主题:', e.subject || '(无主题)');
        console.log('发件人:', from);
        console.log('日期:', date);
        console.log('UID:', item.uid);
        console.log('摘要:', preview);
        console.log('');
      });
      
      imap.end();
    });
  });
});

imap.once('error', (err) => {
  console.error('IMAP 错误:', err.message);
});

imap.once('end', () => {
  console.log('连接已关闭');
});

console.log('正在连接 IMAP 服务器...');
imap.connect();
