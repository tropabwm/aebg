import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, Settings, FileText, Video, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface VideoProcessingOptions {
  videoCodec: string;
  audioCodec: string;
  videoQuality: number;
  audioQuality: number;
  silenceThreshold: number;
  frameMargin: number;
  videoSpeed: number;
  audioSpeed: number;
  keepTrackSeparate: boolean;
  exportFormat: string;
  resolution: string;
}

interface ProcessingStatus {
  isProcessing: boolean;
  progress: number;
  currentStep: string;
  error: string | null;
}

interface SubtitleEntry {
  start: number;
  end: number;
  text: string;
}

function App() {
  const [originalVideo, setOriginalVideo] = useState<string | null>(null);
  const [processedVideo, setProcessedVideo] = useState<string | null>(null);
  const [backgroundRemovedVideo, setBackgroundRemovedVideo] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'auto-editor' | 'background-remover'>('auto-editor');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    currentStep: '',
    error: null
  });
  
  const [options, setOptions] = useState<VideoProcessingOptions>({
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoQuality: 23,
    audioQuality: 128,
    silenceThreshold: 0.04,
    frameMargin: 1,
    videoSpeed: 1.0,
    audioSpeed: 1.0,
    keepTrackSeparate: false,
    exportFormat: 'mp4',
    resolution: '1920x1080'
  });

  const [backgroundOptions, setBackgroundOptions] = useState({
    backgroundType: 'transparent' as 'transparent' | 'color' | 'image',
    backgroundColor: '#00ff00',
    backgroundImage: null as File | null,
    quality: 'high' as 'low' | 'medium' | 'high',
    fastMode: false
  });

  const [isPlaying, setIsPlaying] = useState({ original: false, processed: false });
  const [currentTime, setCurrentTime] = useState({ original: 0, processed: 0 });
  const [duration, setDuration] = useState({ original: 0, processed: 0 });
  const [volume, setVolume] = useState({ original: 1, processed: 1 });
  const [isMuted, setIsMuted] = useState({ original: false, processed: false });
  
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const processedVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);

  // Sync video players
  const syncPlayers = (source: 'original' | 'processed', time: number) => {
    const otherPlayer = source === 'original' ? processedVideoRef.current : originalVideoRef.current;
    if (otherPlayer && Math.abs(otherPlayer.currentTime - time) > 0.5) {
      otherPlayer.currentTime = time;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setOriginalVideo(url);
      setProcessedVideo(null);
      setBackgroundRemovedVideo(null);
      setSubtitles([]);
    }
  };

  const handleBackgroundImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBackgroundOptions(prev => ({ ...prev, backgroundImage: file }));
    }
  };

  const processVideo = async () => {
    if (!originalVideo) return;

    setProcessingStatus({
      isProcessing: true,
      progress: 0,
      currentStep: 'Verificando auto-editor...',
      error: null
    });

    try {
      // First check if auto-editor is available
      const healthResponse = await fetch('/api/test-auto-editor');
      const healthData = await healthResponse.json();
      
      if (!healthData.installed) {
        throw new Error('Auto-editor não está instalado. Execute install-auto-editor.bat');
      }
      
      setProcessingStatus(prev => ({
        ...prev,
        currentStep: 'Preparando arquivo...',
        progress: 10
      }));
      
      const formData = new FormData();
      const response = await fetch(originalVideo);
      const blob = await response.blob();
      formData.append('video', blob);
      formData.append('options', JSON.stringify(options));

      setProcessingStatus(prev => ({
        ...prev,
        currentStep: 'Processando vídeo com auto-editor...',
        progress: 20
      }));
      
      const processResponse = await fetch('/api/process-video', {
        method: 'POST',
        body: formData
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Erro no processamento do vídeo');
      }

      const result = await processResponse.json();
      setProcessedVideo(result.videoUrl);
      setSubtitles(result.subtitles || []);
      
      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        currentStep: 'Processamento concluído com sucesso!',
        error: null
      });
    } catch (error) {
      console.error('Erro no processamento:', error);
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        currentStep: '',
        error: error instanceof Error ? error.message : 'Erro desconhecido no processamento'
      });
    }
  };

  const removeBackground = async () => {
    if (!originalVideo) return;

    setProcessingStatus({
      isProcessing: true,
      progress: 0,
      currentStep: 'Preparando para remoção de background...',
      error: null
    });

    try {
      const formData = new FormData();
      const response = await fetch(originalVideo);
      const blob = await response.blob();
      formData.append('video', blob);
      formData.append('options', JSON.stringify(backgroundOptions));

      if (backgroundOptions.backgroundImage) {
        formData.append('backgroundImage', backgroundOptions.backgroundImage);
      }

      setProcessingStatus(prev => ({
        ...prev,
        currentStep: 'Removendo background...',
        progress: 20
      }));
      
      const processResponse = await fetch('/api/remove-background', {
        method: 'POST',
        body: formData
      });

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Erro HTTP ${processResponse.status}: ${errorText}`);
        }
        throw new Error(errorData.error || 'Erro na remoção do background');
      }

      const result = await processResponse.json();
      setBackgroundRemovedVideo(result.videoUrl);
      
      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        currentStep: 'Remoção de background concluída com sucesso!',
        error: null
      });
    } catch (error) {
      console.error('Erro na remoção de background:', error);
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        currentStep: '',
        error: error instanceof Error ? error.message : 'Erro desconhecido na remoção de background'
      });
    }
  };

  const exportVideo = async () => {
    const videoToExport = activeTab === 'auto-editor' ? processedVideo : backgroundRemovedVideo;
    if (!videoToExport) return;
    
    try {
      const response = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: options.exportFormat })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_video.${options.exportFormat}`;
        a.click();
      }
    } catch (error) {
      console.error('Erro ao exportar vídeo:', error);
    }
  };

  const exportSubtitles = () => {
    if (subtitles.length === 0) return;
    
    const srtContent = subtitles.map((sub, index) => {
      const start = formatSRTTime(sub.start);
      const end = formatSRTTime(sub.end);
      return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
    }).join('\n');
    
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
  };

  const formatSRTTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = (player: 'original' | 'processed') => {
    const videoRef = player === 'original' ? originalVideoRef.current : processedVideoRef.current;
    if (videoRef) {
      if (isPlaying[player]) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(prev => ({ ...prev, [player]: !prev[player] }));
    }
  };

  const handleTimeUpdate = (player: 'original' | 'processed') => {
    const videoRef = player === 'original' ? originalVideoRef.current : processedVideoRef.current;
    if (videoRef) {
      const time = videoRef.currentTime;
      setCurrentTime(prev => ({ ...prev, [player]: time }));
      syncPlayers(player, time);
      
      // Update current subtitle
      const currentSub = subtitles.find(sub => time >= sub.start && time <= sub.end);
      setCurrentSubtitle(currentSub?.text || '');
    }
  };

  const handleVolumeChange = (player: 'original' | 'processed', newVolume: number) => {
    const videoRef = player === 'original' ? originalVideoRef.current : processedVideoRef.current;
    if (videoRef) {
      videoRef.volume = newVolume;
      setVolume(prev => ({ ...prev, [player]: newVolume }));
    }
  };

  const toggleMute = (player: 'original' | 'processed') => {
    const videoRef = player === 'original' ? originalVideoRef.current : processedVideoRef.current;
    if (videoRef) {
      videoRef.muted = !isMuted[player];
      setIsMuted(prev => ({ ...prev, [player]: !prev[player] }));
    }
  };

  const resetProcessing = () => {
    setProcessedVideo(null);
    setBackgroundRemovedVideo(null);
    setSubtitles([]);
    setCurrentSubtitle('');
    setProcessingStatus({
      isProcessing: false,
      progress: 0,
      currentStep: '',
      error: null
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Video className="w-8 h-8 text-blue-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Auto-Editor Pro
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('auto-editor')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'auto-editor' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Auto-Editor
                </button>
                <button
                  onClick={() => setActiveTab('background-remover')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    activeTab === 'background-remover' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Background Remover
                </button>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>Carregar Vídeo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={backgroundImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Video Players */}
          <div className="xl:col-span-2 space-y-6">
            {/* Original Video */}
            <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Video className="w-5 h-5 mr-2 text-green-400" />
                Vídeo Original
              </h3>
              {originalVideo ? (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={originalVideoRef}
                      src={originalVideo}
                      className="w-full h-64 object-contain"
                      onTimeUpdate={() => handleTimeUpdate('original')}
                      onLoadedMetadata={() => {
                        if (originalVideoRef.current) {
                          setDuration(prev => ({ ...prev, original: originalVideoRef.current!.duration }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => togglePlay('original')}
                      className="flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                    >
                      {isPlaying.original ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max={duration.original}
                        value={currentTime.original}
                        onChange={(e) => {
                          const time = parseFloat(e.target.value);
                          if (originalVideoRef.current) {
                            originalVideoRef.current.currentTime = time;
                            syncPlayers('original', time);
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleMute('original')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {isMuted.original ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume.original}
                        onChange={(e) => handleVolumeChange('original', parseFloat(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-lg p-12 text-center">
                  <Video className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-400">Carregue um vídeo para começar</p>
                </div>
              )}
            </div>

            {/* Processed Video */}
            <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Video className="w-5 h-5 mr-2 text-purple-400" />
                {activeTab === 'auto-editor' ? 'Vídeo Processado (Auto-Editor)' : 'Vídeo com Background Removido'}
              </h3>
              {(activeTab === 'auto-editor' ? processedVideo : backgroundRemovedVideo) ? (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={processedVideoRef}
                      src={activeTab === 'auto-editor' ? processedVideo! : backgroundRemovedVideo!}
                      className="w-full h-64 object-contain"
                      onTimeUpdate={() => handleTimeUpdate('processed')}
                      onLoadedMetadata={() => {
                        if (processedVideoRef.current) {
                          setDuration(prev => ({ ...prev, processed: processedVideoRef.current!.duration }));
                        }
                      }}
                    />
                    {/* Subtitles Overlay */}
                    {activeTab === 'auto-editor' && currentSubtitle && (
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg">
                        {currentSubtitle}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => togglePlay('processed')}
                      className="flex items-center justify-center w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
                    >
                      {isPlaying.processed ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max={duration.processed}
                        value={currentTime.processed}
                        onChange={(e) => {
                          const time = parseFloat(e.target.value);
                          if (processedVideoRef.current) {
                            processedVideoRef.current.currentTime = time;
                            syncPlayers('processed', time);
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleMute('processed')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {isMuted.processed ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume.processed}
                        onChange={(e) => handleVolumeChange('processed', parseFloat(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-lg p-12 text-center">
                  <Video className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-400">
                    {activeTab === 'auto-editor' 
                      ? 'Processe um vídeo para visualizar o resultado' 
                      : 'Remova o background de um vídeo para visualizar o resultado'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Processing Status */}
            {(processingStatus.isProcessing || processingStatus.error) && (
              <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4">Status do Processamento</h3>
                {processingStatus.isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">{processingStatus.currentStep}</span>
                      <span className="text-sm text-slate-400">{processingStatus.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${processingStatus.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {processingStatus.error && (
                  <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                    <p className="text-red-400">{processingStatus.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {activeTab === 'auto-editor' ? (
              <>
            {/* Processing Options */}
            <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-blue-400" />
                Configurações de Processamento
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Limite de Silêncio</label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.1"
                    step="0.01"
                    value={options.silenceThreshold}
                    onChange={(e) => setOptions(prev => ({ ...prev, silenceThreshold: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-xs text-slate-400">{options.silenceThreshold}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Margem de Quadros</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={options.frameMargin}
                    onChange={(e) => setOptions(prev => ({ ...prev, frameMargin: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-xs text-slate-400">{options.frameMargin}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Qualidade do Vídeo</label>
                  <select
                    value={options.videoQuality}
                    onChange={(e) => setOptions(prev => ({ ...prev, videoQuality: parseInt(e.target.value) }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value={18}>Muito Alta (18)</option>
                    <option value={23}>Alta (23)</option>
                    <option value={28}>Média (28)</option>
                    <option value={33}>Baixa (33)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Resolução</label>
                  <select
                    value={options.resolution}
                    onChange={(e) => setOptions(prev => ({ ...prev, resolution: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="1920x1080">1080p (1920x1080)</option>
                    <option value="1280x720">720p (1280x720)</option>
                    <option value="854x480">480p (854x480)</option>
                    <option value="640x360">360p (640x360)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Codec de Vídeo</label>
                  <select
                    value={options.videoCodec}
                    onChange={(e) => setOptions(prev => ({ ...prev, videoCodec: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="libx264">H.264 (libx264)</option>
                    <option value="libx265">H.265 (libx265)</option>
                    <option value="libvpx-vp9">VP9 (libvpx-vp9)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Formato de Exportação</label>
                  <select
                    value={options.exportFormat}
                    onChange={(e) => setOptions(prev => ({ ...prev, exportFormat: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                    <option value="avi">AVI</option>
                    <option value="mkv">MKV</option>
                  </select>
                </div>
              </div>
            </div>
              </>
            ) : (
              <>
            {/* Background Removal Options */}
            <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-purple-400" />
                Configurações de Remoção de Background
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de Background</label>
                  <select
                    value={backgroundOptions.backgroundType}
                    onChange={(e) => setBackgroundOptions(prev => ({ 
                      ...prev, 
                      backgroundType: e.target.value as 'transparent' | 'color' | 'image' 
                    }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="transparent">Transparente</option>
                    <option value="color">Cor Sólida</option>
                    <option value="image">Imagem</option>
                  </select>
                </div>

                {backgroundOptions.backgroundType === 'color' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Cor do Background</label>
                    <input
                      type="color"
                      value={backgroundOptions.backgroundColor}
                      onChange={(e) => setBackgroundOptions(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      className="w-full h-10 bg-slate-700 border border-slate-600 rounded-lg"
                    />
                  </div>
                )}

                {backgroundOptions.backgroundType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Imagem de Background</label>
                    <button
                      onClick={() => backgroundImageInputRef.current?.click()}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-left hover:bg-slate-600 transition-colors"
                    >
                      {backgroundOptions.backgroundImage ? backgroundOptions.backgroundImage.name : 'Selecionar imagem...'}
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Qualidade</label>
                  <select
                    value={backgroundOptions.quality}
                    onChange={(e) => setBackgroundOptions(prev => ({ 
                      ...prev, 
                      quality: e.target.value as 'low' | 'medium' | 'high' 
                    }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="fastMode"
                    checked={backgroundOptions.fastMode}
                    onChange={(e) => setBackgroundOptions(prev => ({ ...prev, fastMode: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="fastMode" className="text-sm font-medium">
                    Modo Rápido (BiRefNet Lite)
                  </label>
                </div>
              </div>
            </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Ações</h3>
              <div className="space-y-3">
                {activeTab === 'auto-editor' ? (
                <button
                  onClick={processVideo}
                  disabled={!originalVideo || processingStatus.isProcessing}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <Play className="w-5 h-5" />
                  <span>{processingStatus.isProcessing ? 'Processando...' : 'Processar Vídeo'}</span>
                </button>
                ) : (
                <button
                  onClick={removeBackground}
                  disabled={!originalVideo || processingStatus.isProcessing}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <Video className="w-5 h-5" />
                  <span>{processingStatus.isProcessing ? 'Removendo Background...' : 'Remover Background'}</span>
                </button>
                )}

                <button
                  onClick={resetProcessing}
                  className="w-full bg-slate-600 hover:bg-slate-700 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Resetar</span>
                </button>

                <div className="border-t border-slate-700 pt-3">
                  <button
                    onClick={exportVideo}
                    disabled={activeTab === 'auto-editor' ? !processedVideo : !backgroundRemovedVideo}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mb-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Exportar Vídeo</span>
                  </button>

                  {activeTab === 'auto-editor' && (
                  <button
                    onClick={exportSubtitles}
                    disabled={subtitles.length === 0}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-5 h-5" />
                    <span>Exportar Legendas (.srt)</span>
                  </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subtitles Panel */}
            {activeTab === 'auto-editor' && subtitles.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur-md rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-yellow-400" />
                  Legendas Sincronizadas
                </h3>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {subtitles.map((sub, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border ${
                        currentSubtitle === sub.text 
                          ? 'bg-yellow-900/20 border-yellow-600' 
                          : 'bg-slate-700/30 border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-slate-400">
                          {formatTime(sub.start)} → {formatTime(sub.end)}
                        </span>
                      </div>
                      <p className="text-sm">{sub.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;