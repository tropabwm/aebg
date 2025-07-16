const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname) || '.mp4'; // Default to .mp4 if no extension
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/avi', 
      'video/mov',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/mkv',
      'video/x-matroska'
    ];
    
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado. Use: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

// Configure multer for multiple files
const uploadMultiple = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      const allowedMimes = [
        'video/mp4',
        'video/avi', 
        'video/mov',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
        'video/mkv',
        'video/x-matroska'
      ];
      
      const allowedExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error(`Formato de vídeo não suportado. Use: ${allowedExtensions.join(', ')}`), false);
      }
    } else if (file.fieldname === 'backgroundImage') {
      const allowedImageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
      const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedImageMimes.includes(file.mimetype) || allowedImageExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error(`Formato de imagem não suportado. Use: ${allowedImageExtensions.join(', ')}`), false);
      }
    } else {
      cb(new Error('Campo de arquivo não reconhecido'), false);
    }
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Check if auto-editor is installed
function checkAutoEditor() {
  return new Promise((resolve) => {
    exec('auto-editor --help', (error, stdout, stderr) => {
      if (error) {
        // Try with python -m auto_editor
        exec('python -m auto_editor --help', (error2, stdout2, stderr2) => {
          if (error2) {
            resolve({ installed: false, command: null });
          } else {
            resolve({ installed: true, command: 'python -m auto_editor' });
          }
        });
      } else {
        resolve({ installed: true, command: 'auto-editor' });
      }
    });
  });
}

// Auto-editor processing endpoint (original functionality)
app.post('/api/process-video', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    // Check if auto-editor is available
    const autoEditorCheck = await checkAutoEditor();
    if (!autoEditorCheck.installed) {
      return res.status(500).json({ 
        error: 'Auto-editor não está instalado. Execute: pip install auto-editor' 
      });
    }

    const inputPath = req.file.path;
    
    // Verify input file has extension
    if (!path.extname(inputPath)) {
      return res.status(400).json({ 
        error: 'Arquivo deve ter uma extensão válida (.mp4, .avi, .mov, etc.)' 
      });
    }
    
    const outputDir = path.join(__dirname, 'uploads', 'processed');
    const outputPath = path.join(outputDir, `processed-${Date.now()}.mp4`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const options = JSON.parse(req.body.options || '{}');
    
    // Build auto-editor command arguments
    const args = [
      inputPath,
      '--output', outputPath,
      '--silent-threshold', (options.silenceThreshold || 0.04).toString(),
      '--frame-margin', (options.frameMargin || 1).toString(),
      '--video-codec', options.videoCodec || 'libx264',
      '--audio-codec', options.audioCodec || 'aac'
    ];

    // Add quality settings
    if (options.videoQuality) {
      args.push('--video-bitrate', `${options.videoQuality}M`);
    }

    console.log('Executando comando:', autoEditorCheck.command, args.join(' '));
    console.log('Arquivo de entrada:', inputPath);
    console.log('Arquivo de saída:', outputPath);
    
    // Use spawn instead of exec for better control
    const autoEditorProcess = spawn(autoEditorCheck.command.split(' ')[0], 
      autoEditorCheck.command.includes('python') ? 
        ['-m', 'auto_editor', ...args] : args, 
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';

    autoEditorProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Auto-editor stdout:', data.toString());
    });

    autoEditorProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('Auto-editor stderr:', data.toString());
    });

    autoEditorProcess.on('close', (code) => {
      console.log(`Auto-editor process exited with code ${code}`);
      
      if (code !== 0) {
        console.error('Auto-editor error:', stderr);
        return res.status(500).json({ 
          error: `Erro no processamento do vídeo (código ${code}): ${stderr}` 
        });
      }
      
      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ 
          error: 'Vídeo processado não foi criado. Verifique os logs do auto-editor.' 
        });
      }
      
      // Generate subtitles based on processing
      const subtitles = generateSubtitlesFromAutoEditor(stdout, stderr);
      
      // Return relative paths for frontend access
      const videoUrl = '/uploads/processed/' + path.basename(outputPath);
      
      res.json({
        success: true,
        videoUrl: videoUrl,
        subtitles: subtitles,
        message: 'Vídeo processado com sucesso!',
        logs: stdout
      });
      
      // Clean up input file after a delay
      setTimeout(() => {
        fs.unlink(inputPath, (unlinkError) => {
          if (unlinkError) console.error('Erro ao remover arquivo temporário:', unlinkError);
        });
      }, 5000);
    });

    autoEditorProcess.on('error', (error) => {
      console.error('Erro ao executar auto-editor:', error);
      res.status(500).json({ 
        error: 'Erro ao executar auto-editor: ' + error.message 
      });
    });
    
  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
  }
});

// Background removal endpoint
app.post('/api/remove-background', uploadMultiple.fields([
  { name: 'video', maxCount: 1 },
  { name: 'backgroundImage', maxCount: 1 }
]), async (req, res) => {
  if (!req.files || !req.files.video) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    const inputPath = req.files.video[0].path;
    const options = JSON.parse(req.body.options || '{}');
    
    const outputDir = path.join(__dirname, 'uploads', 'processed');
    const outputPath = path.join(outputDir, `background-removed-${Date.now()}.mp4`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Prepare Python script arguments
    const pythonArgs = [
      path.join(__dirname, 'background_remover.py'),
      '--input', inputPath,
      '--output', outputPath,
      '--background-type', options.backgroundType || 'transparent',
      '--quality', options.quality || 'high'
    ];

    // Add background value if specified
    if (options.backgroundType === 'color' && options.backgroundColor) {
      pythonArgs.push('--background-value', options.backgroundColor);
    } else if (options.backgroundType === 'image' && req.files.backgroundImage) {
      pythonArgs.push('--background-value', req.files.backgroundImage[0].path);
    }

    // Add fast mode flag
    if (options.fastMode) {
      pythonArgs.push('--fast-mode');
    }

    console.log('Executando remoção de background:', 'python', pythonArgs.join(' '));
    
    // Execute Python script
    const pythonProcess = spawn('python', pythonArgs, 
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Background remover stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('Background remover stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Background remover process exited with code ${code}`);
      
      if (code !== 0) {
        console.error('Background remover error:', stderr);
        return res.status(500).json({ 
          error: `Erro na remoção de background (código ${code}): ${stderr}` 
        });
      }
      
      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ 
          error: 'Vídeo com background removido não foi criado. Verifique os logs.' 
        });
      }
      
      // Return relative paths for frontend access
      const videoUrl = '/uploads/processed/' + path.basename(outputPath);
      
      res.json({
        success: true,
        videoUrl: videoUrl,
        message: 'Background removido com sucesso!',
        logs: stdout
      });
      
      // Clean up input file after a delay
      setTimeout(() => {
        fs.unlink(inputPath, (unlinkError) => {
          if (unlinkError) console.error('Erro ao remover arquivo temporário:', unlinkError);
        });
        
        // Clean up background image if uploaded
        if (req.files.backgroundImage) {
          fs.unlink(req.files.backgroundImage[0].path, (unlinkError) => {
            if (unlinkError) console.error('Erro ao remover imagem de background temporária:', unlinkError);
          });
        }
      }, 5000);
    });

    pythonProcess.on('error', (error) => {
      console.error('Erro ao executar script de remoção de background:', error);
      res.status(500).json({ 
        error: 'Erro ao executar remoção de background: ' + error.message 
      });
    });
    
  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
  }
});

// Generate subtitles from auto-editor output
function generateSubtitlesFromAutoEditor(stdout, stderr) {
  const subtitles = [];
  const output = stdout + stderr;
  
  // Parse auto-editor output for timing information
  const lines = output.split('\n');
  let currentTime = 0;
  let segmentIndex = 1;
  
  for (const line of lines) {
    // Look for timing patterns and processing information
    const timeMatch = line.match(/(\d+):(\d+):(\d+\.?\d*)/);
    const segmentMatch = line.match(/(segment|cut|keep|silent|loud)/i);
    const progressMatch = line.match(/(\d+)%/);
    
    if (timeMatch && segmentMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseFloat(timeMatch[3]);
      const timestamp = hours * 3600 + minutes * 60 + seconds;
      
      const isKeep = line.toLowerCase().includes('keep') || line.toLowerCase().includes('loud');
      const text = isKeep ? 
        `Segmento ${segmentIndex}: Conteúdo mantido` : 
        `Segmento ${segmentIndex}: Silêncio removido`;
      
      subtitles.push({
        start: timestamp,
        end: timestamp + 5, // Default 5 second duration
        text: text
      });
      
      segmentIndex++;
      currentTime = timestamp + 5;
    }
  }
  
  // If no specific segments found, create default subtitles
  if (subtitles.length === 0) {
    // Create subtitles every 10 seconds
    for (let i = 0; i < 120; i += 10) {
      subtitles.push({
        start: i,
        end: i + 10,
        text: `Segmento ${Math.floor(i/10) + 1}: Processado pelo auto-editor`
      });
    }
  }
  
  return subtitles;
}

// Helper function to format time for subtitles
function formatSubtitleTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Export video endpoint
app.post('/api/export-video', (req, res) => {
  const { format, videoPath } = req.body;
  
  if (!videoPath) {
    return res.status(400).json({ error: 'Caminho do vídeo não fornecido' });
  }
  
  // For now, return the existing video
  // In a full implementation, you would convert the format here
  res.json({ 
    message: `Vídeo exportado em formato ${format}`,
    downloadUrl: videoPath
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const autoEditorCheck = await checkAutoEditor();
  
  // Check Python and background removal dependencies
  const pythonCheck = await new Promise((resolve) => {
    exec('python -c "import torch, transformers, moviepy; print(\'Dependencies OK\')"', (error, stdout, stderr) => {
      resolve({ 
        available: !error, 
        message: error ? 'Dependências do Python não encontradas' : 'Dependências OK' 
      });
    });
  });
  
  res.json({ 
    status: 'OK', 
    message: 'Auto-Editor API está funcionando',
    autoEditor: autoEditorCheck,
    backgroundRemoval: pythonCheck
  });
});

// Test auto-editor installation
app.get('/api/test-auto-editor', async (req, res) => {
  const autoEditorCheck = await checkAutoEditor();
  
  if (!autoEditorCheck.installed) {
    return res.json({
      installed: false,
      message: 'Auto-editor não está instalado',
      instructions: 'Execute: pip install auto-editor'
    });
  }
  
  // Test with help command
  exec(`${autoEditorCheck.command} --help`, (error, stdout, stderr) => {
    if (error) {
      res.json({
        installed: false,
        error: error.message,
        stderr: stderr
      });
    } else {
      res.json({
        installed: true,
        command: autoEditorCheck.command,
        help: stdout.substring(0, 500) + '...' || 'Help não detectado'
      });
    }
  });
});

// Create necessary directories on startup
const createDirectories = () => {
  const dirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'processed'),
    path.join(__dirname, 'models')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Diretório criado: ${dir}`);
    }
  });
};

// Initialize directories
createDirectories();

// Start server
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse a API em: http://127.0.0.1:${PORT}`);
  console.log(`Health check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`Test auto-editor: http://127.0.0.1:${PORT}/api/test-auto-editor`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Erro: Porta ${PORT} já está em uso!`);
    console.error('Execute kill-processes.bat para finalizar processos existentes');
    process.exit(1);
  } else {
    console.error('Erro no servidor:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nFinalizando servidor...');
  server.close(() => {
    console.log('Servidor finalizado.');
    process.exit(0);
  });
});

module.exports = app;