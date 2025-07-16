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

// Auto-editor processing endpoint
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
      '--output', outputPath
    ];

    // Primeiro teste apenas com parâmetros básicos
    // Adicione outros parâmetros gradualmente após confirmar que funciona
    
    console.log('Testando com comando básico primeiro...');

    console.log('Executando comando:', autoEditorCheck.command, args.join(' '));
    console.log('Arquivo de entrada:', inputPath);
    console.log('Arquivo de saída:', outputPath);
    console.log('Extensão do arquivo:', path.extname(inputPath));
    
    // Use spawn instead of exec for better control
    const autoEditorProcess = spawn(autoEditorCheck.command.split(' ')[0], 
      autoEditorCheck.command.includes('python') ? 
        ['-m', 'auto_editor', ...args] : args, 
      { 
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      }
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
      
      // Generate simple subtitles based on processing
      const subtitles = generateSimpleSubtitles(stdout);
      
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

// Generate simple subtitles from auto-editor output
function generateSimpleSubtitles(autoEditorOutput) {
  const subtitles = [];
  
  // Try to extract timing information from auto-editor output
  const lines = autoEditorOutput.split('\n');
  let segmentCount = 0;
  
  for (const line of lines) {
    if (line.includes('segment') || line.includes('cut')) {
      segmentCount++;
      const start = segmentCount * 5; // Simple timing
      const end = start + 4;
      subtitles.push({
        start: start,
        end: end,
        text: `Segmento ${segmentCount}`
      });
    }
  }
  
  // If no segments found, create a default subtitle
  if (subtitles.length === 0) {
    subtitles.push({
      start: 0,
      end: 10,
      text: 'Vídeo processado pelo Auto-Editor'
    });
  }
  
  return subtitles;
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
  res.json({ 
    status: 'OK', 
    message: 'Auto-Editor API está funcionando',
    autoEditor: autoEditorCheck
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