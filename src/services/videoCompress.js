const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

/** Stay under Gmail's ~25MB cap after MIME encoding. */
const DEFAULT_GMAIL_MAX_BYTES = 20 * 1024 * 1024;

const VIDEO_MIME_RE = /^video\//i;
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|avi|mkv|webm|3gp|mpeg|mpg|wmv)$/i;

function isVideoAttachment(file) {
  if (file?.contentType && VIDEO_MIME_RE.test(file.contentType)) return true;
  return VIDEO_EXT_RE.test(file?.filename || '');
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

let ffmpegResolved;

function candidateBins() {
  const fromEnvFfmpeg = process.env.FFMPEG_PATH?.trim();
  const fromEnvProbe = process.env.FFPROBE_PATH?.trim();
  if (fromEnvFfmpeg && fromEnvProbe) {
    return [{ ffmpegBin: fromEnvFfmpeg, ffprobeBin: fromEnvProbe }];
  }
  const localApp = process.env.LOCALAPPDATA || '';
  const wingetLinks = localApp
    ? path.join(localApp, 'Microsoft', 'WinGet', 'Links')
    : '';
  return [
    { ffmpegBin: 'ffmpeg', ffprobeBin: 'ffprobe' },
    wingetLinks && {
      ffmpegBin: path.join(wingetLinks, 'ffmpeg.exe'),
      ffprobeBin: path.join(wingetLinks, 'ffprobe.exe'),
    },
    {
      ffmpegBin: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
      ffprobeBin: 'C:\\ffmpeg\\bin\\ffprobe.exe',
    },
  ].filter(Boolean);
}

async function resolveFfmpegBins() {
  if (ffmpegResolved) return ffmpegResolved;
  for (const candidate of candidateBins()) {
    try {
      await runCommand(candidate.ffmpegBin, ['-version']);
      await runCommand(candidate.ffprobeBin, ['-version']);
      ffmpegResolved = { ...candidate, available: true };
      return ffmpegResolved;
    } catch {
      /* try next */
    }
  }
  ffmpegResolved = {
    ffmpegBin: process.env.FFMPEG_PATH?.trim() || 'ffmpeg',
    ffprobeBin: process.env.FFPROBE_PATH?.trim() || 'ffprobe',
    available: false,
  };
  return ffmpegResolved;
}

async function probeDurationSeconds(ffprobeBin, filePath) {
  const { stdout } = await runCommand(ffprobeBin, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Could not read video duration');
  }
  return duration;
}

function tempPaths(filename) {
  const id = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filename || '') || '.mp4';
  const base = path.join(os.tmpdir(), `trailer-mail-${id}`);
  return {
    input: `${base}-in${ext}`,
    output: `${base}-out.mp4`,
  };
}

/**
 * Compress a video buffer toward maxBytes. Returns a new attachment or null if not possible.
 */
async function compressVideoForEmail(file, maxBytes = DEFAULT_GMAIL_MAX_BYTES) {
  const bins = await resolveFfmpegBins();
  if (!bins.available) {
    throw new Error(
      'ffmpeg/ffprobe not found. Install ffmpeg or set FFMPEG_PATH and FFPROBE_PATH.'
    );
  }

  const { input, output } = tempPaths(file.filename);
  try {
    fs.writeFileSync(input, file.content);
    const duration = await probeDurationSeconds(bins.ffprobeBin, input);
    // Leave headroom for audio + container; target ~85% of max as video stream.
    const audioBitrate = 96_000;
    const totalBits = Math.max(maxBytes * 8 * 0.85, 400_000);
    let videoBitrate = Math.floor(totalBits / duration - audioBitrate);
    if (videoBitrate < 120_000) videoBitrate = 120_000;

    const attempts = [
      { videoBitrate, scale: null },
      { videoBitrate: Math.floor(videoBitrate * 0.65), scale: '1280:-2' },
      { videoBitrate: Math.floor(videoBitrate * 0.4), scale: '854:-2' },
      { videoBitrate: Math.max(100_000, Math.floor(videoBitrate * 0.25)), scale: '640:-2' },
    ];

    let best = null;
    for (const attempt of attempts) {
      if (fs.existsSync(output)) fs.unlinkSync(output);
      const args = [
        '-y',
        '-i',
        input,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-b:v',
        String(attempt.videoBitrate),
        '-maxrate',
        String(Math.floor(attempt.videoBitrate * 1.15)),
        '-bufsize',
        String(Math.floor(attempt.videoBitrate * 2)),
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
      ];
      if (attempt.scale) {
        args.push('-vf', `scale=${attempt.scale}`);
      }
      args.push(output);

      console.log(
        `[videoCompress] ${file.filename}: target ${(maxBytes / 1024 / 1024).toFixed(1)}MB, vbitrate ${attempt.videoBitrate}`
      );
      await runCommand(bins.ffmpegBin, args);
      const content = fs.readFileSync(output);
      if (!best || content.length < best.content.length) {
        best = { content, size: content.length };
      }
      if (content.length <= maxBytes) {
        const baseName = path.basename(file.filename || 'video', path.extname(file.filename || ''));
        return {
          filename: `${baseName}-email.mp4`,
          content,
          contentType: 'video/mp4',
          compressed: true,
          originalBytes: file.content.length,
          outputBytes: content.length,
        };
      }
    }

    if (best && best.size <= maxBytes) {
      const baseName = path.basename(file.filename || 'video', path.extname(file.filename || ''));
      return {
        filename: `${baseName}-email.mp4`,
        content: best.content,
        contentType: 'video/mp4',
        compressed: true,
        originalBytes: file.content.length,
        outputBytes: best.size,
      };
    }
    return null;
  } finally {
    try {
      if (fs.existsSync(input)) fs.unlinkSync(input);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(output)) fs.unlinkSync(output);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Build email attachments under Gmail size. Originals stay for Slack separately.
 * @returns {{ attachments: object[], notes: string[] }}
 */
async function prepareEmailAttachments(files, maxBytes = DEFAULT_GMAIL_MAX_BYTES) {
  const attachments = [];
  const notes = [];

  for (const file of files || []) {
    const size = file.content?.length || 0;
    if (size <= maxBytes) {
      attachments.push({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      });
      continue;
    }

    if (!isVideoAttachment(file)) {
      notes.push(
        `${file.filename} (${(size / 1024 / 1024).toFixed(1)}MB) is over the email limit and was left in the Slack thread only.`
      );
      continue;
    }

    try {
      const compressed = await compressVideoForEmail(file, maxBytes);
      if (compressed) {
        attachments.push(compressed);
        notes.push(
          `${file.filename} was compressed from ${(size / 1024 / 1024).toFixed(1)}MB to ${(compressed.outputBytes / 1024 / 1024).toFixed(1)}MB for email. Full original is in the Slack thread.`
        );
      } else {
        notes.push(
          `${file.filename} could not be compressed under the email limit. Full original is in the Slack thread.`
        );
      }
    } catch (err) {
      console.error('[videoCompress] failed for', file.filename, err.message);
      notes.push(
        `${file.filename} could not be compressed for email (${err.message}). Full original is in the Slack thread.`
      );
    }
  }

  return { attachments, notes };
}

module.exports = {
  DEFAULT_GMAIL_MAX_BYTES,
  isVideoAttachment,
  resolveFfmpegBins,
  compressVideoForEmail,
  prepareEmailAttachments,
};
