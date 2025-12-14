
import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { 
  Bot, Layers, Settings, Sparkles, AlertTriangle, X, ChevronRight, 
  Cpu, Activity, Lock, Unlock, Zap, Globe, ShoppingBag, 
  Aperture, Radio, LayoutGrid, MonitorPlay, Fingerprint, Box,
  User, Image as ImageIcon, Video, ShieldCheck, Terminal
} from 'lucide-react';
import { ImageUploader, VideoUploader } from './components/ImageUploader';
import { Storyboard } from './components/Storyboard';
import { AnalysisLoader } from './components/AnalysisLoader';
import { analyzeProduct, verifyApiKey, setCustomApiKey } from './services/geminiService';
import { AppState, AspectRatio, VideoMode, StoryboardScene, ImageResolution } from './types';
import { ASPECT_RATIOS, VIDEO_MODES, IMAGE_RESOLUTIONS, TARGET_MARKETS, PLATFORMS } from './constants';

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('gemini_api_key') || '');
  const [authError, setAuthError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [state, setState] = useState<AppState>({
    product: {
      images: [],
      title: '',
      description: '',
      creativeIdeas: '',
      platform: 'tiktok',
      targetMarket: 'US',
      modelImages: [],
      backgroundImages: [],
      referenceVideo: null,
    },
    settings: {
      aspectRatio: AspectRatio.Ratio_9_16,
      imageResolution: ImageResolution.Res_2K,
      videoMode: VideoMode.Standard,
      sceneCount: 1, 
    },
    analysis: null,
    storyboard: [],
    isAnalyzing: false,
    isGeneratingScene: false,
    activeStep: 0,
  });

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'audio' } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentPlatform = PLATFORMS.find(p => p.value === state.product.platform);
  const isDomestic = currentPlatform?.scope === 'domestic';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setIsVerifying(true);
    setAuthError(false);

    const isValid = await verifyApiKey(apiKeyInput.trim());
    
    if (isValid) {
      setCustomApiKey(apiKeyInput.trim());
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
    setIsVerifying(false);
  };

  const handleProductUpdate = (field: string, value: any) => {
    setState(prev => {
        const newState = {
            ...prev,
            product: { ...prev.product, [field]: value }
        };
        if (field === 'platform') {
            const platformObj = PLATFORMS.find(p => p.value === value);
            if (platformObj?.scope === 'domestic') {
                newState.product.targetMarket = 'CN';
            } else if (prev.product.targetMarket === 'CN') {
                newState.product.targetMarket = 'US';
            }
        }
        return newState;
    });
  };

  const startAnalysis = async () => {
    if (state.product.images.length === 0) {
      setErrorMsg("错误: 请至少上传一张产品图片以启动神经网络分析");
      return;
    }
    
    try {
        // @ts-ignore
        if (window.aistudio?.openSelectKey) {
             // @ts-ignore
            const hasKey = await window.aistudio.hasSelectedApiKey();
            // @ts-ignore
            if (!hasKey) await window.aistudio.openSelectKey();
        }
    } catch(e) {}

    setState(prev => ({ ...prev, isAnalyzing: true, activeStep: 1 }));
    setErrorMsg(null);

    try {
      const result = await analyzeProduct(state.product, state.settings.sceneCount);
      const initialStoryboard: StoryboardScene[] = result.scenes.map((s: any) => ({
        ...s,
        isGeneratingImage: false,
        isGeneratingAudio: false,
      }));
      
      setState(prev => ({
        ...prev,
        analysis: result,
        storyboard: initialStoryboard,
        isAnalyzing: false,
        settings: { ...prev.settings, sceneCount: result.scenes.length }
      }));
    } catch (error: any) {
      let errMsg = error.message || "未知错误";
      if (errMsg.includes('429')) errMsg = "API 配额耗尽 (429): 请稍后重试。";
      setErrorMsg(`系统错误: ${errMsg}`);
      setState(prev => ({ ...prev, isAnalyzing: false, activeStep: 0 }));
    }
  };

  const updateScene = (id: string, updates: Partial<StoryboardScene>) => {
    setState(prev => ({
      ...prev,
      storyboard: prev.storyboard.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  // --- LOCK SCREEN (Security Gateway) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center p-4 relative overflow-hidden font-mono">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-cyber-grid bg-[length:30px_30px] opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-neon-primary/10 to-transparent opacity-20"></div>
        
        <div className="w-full max-w-md relative z-10">
           <div className="glass-panel border-t-2 border-t-neon-primary p-10 shadow-[0_0_100px_rgba(124,58,237,0.1)] relative group">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-2 h-2 bg-neon-primary"></div>
              <div className="absolute top-0 right-0 w-2 h-2 bg-neon-primary"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 bg-neon-primary"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 bg-neon-primary"></div>

              <div className="flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-void-800 rounded-full border border-neon-primary flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(124,58,237,0.4)] animate-pulse-slow">
                    <Fingerprint className="text-neon-primary w-10 h-10" />
                 </div>
                 
                 <h1 className="text-2xl font-bold text-white mb-2 tracking-[0.2em] uppercase">创作中枢</h1>
                 <p className="text-neon-secondary text-[10px] mb-8 tracking-[0.3em] uppercase">API 密钥验证 / KEY VERIFICATION</p>

                 <form onSubmit={handleLogin} className="w-full space-y-6">
                    <div className="relative">
                       <ShieldCheck className="absolute left-4 top-3.5 text-slate-500 w-4 h-4" />
                       <input 
                         type="password" 
                         value={apiKeyInput}
                         onChange={(e) => { setApiKeyInput(e.target.value); setAuthError(false); }}
                         className={`w-full bg-void-900 border ${authError ? 'border-neon-alert text-neon-alert' : 'border-white/10 text-neon-primary'} py-3 pl-12 pr-4 outline-none focus:border-neon-primary focus:shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-all placeholder-slate-600 font-mono text-sm`}
                         placeholder="请输入 Gemini API Key (sk-...)"
                         autoFocus
                       />
                    </div>
                    <button 
                      type="submit"
                      disabled={isVerifying}
                      className="w-full py-3 bg-neon-primary hover:bg-neon-primary/80 text-white font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> 
                          验证中...
                        </>
                      ) : (
                        <>
                          <Unlock size={14} /> 验证并解锁
                        </>
                      )}
                    </button>
                 </form>
              </div>
           </div>
           {authError && <div className="mt-4 text-neon-alert text-xs text-center font-mono">错误: API Key 无效或无法连接 / INVALID KEY</div>}
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <HashRouter>
      <div className="min-h-screen bg-void-950 font-sans text-slate-300 flex overflow-hidden">
        {state.isAnalyzing && <AnalysisLoader mode="analysis" variant="fullscreen" />}
        
        {/* LEFT SIDEBAR (Command Strip) */}
        <aside className="w-20 lg:w-72 bg-void-900 border-r border-white/5 flex flex-col z-50">
           <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-primary/10 to-transparent opacity-50"></div>
              <Aperture className="text-neon-primary w-8 h-8 animate-spin-slow relative z-10" />
              <div className="hidden lg:block ml-4 relative z-10">
                  <h1 className="font-bold text-white tracking-widest text-lg">NEXUS</h1>
                  <p className="text-[10px] text-neon-secondary tracking-widest">创作中枢 V4.0</p>
              </div>
           </div>

           <nav className="flex-1 py-8 space-y-2 px-4">
              <div className="text-[10px] font-mono text-slate-600 mb-2 px-2 hidden lg:block">MODULES</div>
              <NavButton 
                active={state.activeStep === 0} 
                onClick={() => setState(prev => ({...prev, activeStep: 0}))}
                icon={<LayoutGrid size={20} />}
                label="数据接入"
                subLabel="DATA INGESTION"
              />
              <NavButton 
                active={state.activeStep === 1} 
                onClick={() => state.storyboard.length > 0 && setState(prev => ({...prev, activeStep: 1}))}
                icon={<Activity size={20} />}
                label="生成核心"
                subLabel="GENERATION CORE"
                disabled={state.storyboard.length === 0}
              />
           </nav>

           <div className="p-6 border-t border-white/5">
              <div className="glass-panel p-4 rounded border-l-2 border-l-neon-secondary">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">系统状态 / STATUS</div>
                  <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-neon-secondary rounded-full animate-pulse shadow-[0_0_10px_#2dd4bf]"></div>
                      <span className="text-xs text-neon-secondary font-mono tracking-wider hidden lg:inline">ONLINE / 在线</span>
                  </div>
              </div>
           </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto h-screen relative scroll-smooth bg-scan-line bg-[length:100%_4px]">
            <div className="p-6 lg:p-12 max-w-[1920px] mx-auto relative z-10">
                {errorMsg && (
                    <div className="mb-8 glass-panel border-l-4 border-neon-alert p-4 text-neon-alert flex items-center gap-3 font-mono text-sm animate-pulse">
                        <AlertTriangle /> {errorMsg}
                    </div>
                )}

                {/* STEP 1: CONFIGURATION */}
                <div className={state.activeStep === 0 ? 'block space-y-8 animate-in fade-in slide-in-from-bottom-4' : 'hidden'}>
                    <header className="mb-8 flex items-end justify-between border-b border-white/5 pb-4">
                        <div>
                            <h1 className="text-3xl font-light text-white mb-2 tracking-tight">初始化项目 <span className="text-neon-primary">/</span></h1>
                            <p className="text-slate-500 font-mono text-xs tracking-wider">配置神经网络生成参数 / CONFIGURE PARAMETERS</p>
                        </div>
                        <div className="text-neon-primary font-mono text-xs border border-neon-primary/30 px-3 py-1 rounded-full bg-neon-primary/5">
                            准备就绪
                        </div>
                    </header>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        {/* LEFT COLUMN: PARAMETERS */}
                        <div className="xl:col-span-4 space-y-6">
                            {/* Platform Module */}
                            <div className="glass-panel p-6 rounded-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><Globe size={80} /></div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <ShoppingBag size={16} className="text-neon-primary"/> 目标生态 / TARGET
                                </h2>
                                
                                <div className="space-y-4 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-neon-secondary font-mono uppercase">电商平台 / PLATFORM</label>
                                        <select 
                                            className="w-full cyber-input text-sm text-slate-300 p-3 rounded-sm"
                                            value={state.product.platform}
                                            onChange={(e) => handleProductUpdate('platform', e.target.value)}
                                        >
                                            {PLATFORMS.map(p => (
                                                <option key={p.value} value={p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {!isDomestic ? (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <label className="text-[10px] text-neon-secondary font-mono uppercase">区域锁定 / REGION LOCK</label>
                                            <select 
                                                className="w-full cyber-input text-sm text-slate-300 p-3 rounded-sm"
                                                value={state.product.targetMarket}
                                                onChange={(e) => handleProductUpdate('targetMarket', e.target.value)}
                                            >
                                                {TARGET_MARKETS.filter(m => m.value !== 'CN').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-void-800 border border-white/10 text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                            <Lock size={12} className="text-neon-primary" /> 
                                            <span>国内协议已激活 (CN Protocol Active)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tech Specs Module */}
                            <div className="glass-panel p-6 rounded-sm">
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Settings size={16} className="text-neon-primary"/> 输出规格 / SPECS
                                </h2>
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 font-mono mb-2">画面比例 / RATIO</label>
                                            <select 
                                                className="w-full cyber-input p-2 text-xs text-white"
                                                value={state.settings.aspectRatio}
                                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, aspectRatio: e.target.value as AspectRatio}}))}
                                            >
                                                {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 font-mono mb-2">分辨率 / RES</label>
                                            <select 
                                                className="w-full cyber-input p-2 text-xs text-white"
                                                value={state.settings.imageResolution}
                                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, imageResolution: e.target.value as ImageResolution}}))}
                                            >
                                                {IMAGE_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 font-mono mb-2">生成模式 / MODE</label>
                                        <div className="flex gap-2 bg-void-800 p-1 border border-white/5">
                                            {VIDEO_MODES.map(m => (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setState(prev => ({...prev, settings: {...prev.settings, videoMode: m.value as VideoMode}}))}
                                                    className={`flex-1 py-2 text-[10px] transition-all ${state.settings.videoMode === m.value ? 'bg-void-700 text-neon-secondary border border-neon-secondary/30 shadow' : 'text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    {m.label.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {!state.product.referenceVideo && (
                                        <div>
                                            <label className="block text-[10px] text-slate-500 font-mono mb-2">分镜数量 / SCENE COUNT</label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="range" min="1" max="10" 
                                                    value={state.settings.sceneCount}
                                                    onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, sceneCount: parseInt(e.target.value)}}))}
                                                    className="flex-1 h-1 bg-void-800 rounded-lg appearance-none cursor-pointer accent-neon-primary"
                                                />
                                                <span className="text-neon-primary font-mono font-bold text-lg">{state.settings.sceneCount}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* Text Input Module */}
                             <div className="glass-panel p-6 rounded-sm space-y-4">
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Terminal size={16} className="text-neon-primary"/> 信息注入 / CONTEXT
                                </h2>
                                <input 
                                    type="text" 
                                    className="w-full cyber-input p-3 text-sm text-white placeholder-slate-700"
                                    placeholder="产品名称 (可选)"
                                    value={state.product.title}
                                    onChange={(e) => handleProductUpdate('title', e.target.value)}
                                />
                                <textarea 
                                    rows={3}
                                    className="w-full cyber-input p-3 text-xs text-slate-300 placeholder-slate-700"
                                    placeholder="产品卖点 / 描述..."
                                    value={state.product.description}
                                    onChange={(e) => handleProductUpdate('description', e.target.value)}
                                />
                                <textarea 
                                    rows={2}
                                    className="w-full cyber-input p-3 text-xs text-slate-300 placeholder-slate-700"
                                    placeholder="创意方向 / 氛围..."
                                    value={state.product.creativeIdeas}
                                    onChange={(e) => handleProductUpdate('creativeIdeas', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: ASSETS */}
                        <div className="xl:col-span-8 flex flex-col gap-6">
                            <div className="glass-panel p-8 flex-1 rounded-sm border border-white/10 shadow-2xl relative">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-neon-primary/5 blur-3xl rounded-full pointer-events-none"></div>
                                <h2 className="text-lg font-light text-white mb-8 flex justify-between items-end border-b border-white/5 pb-4">
                                    <span className="flex items-center gap-3"><Layers className="text-neon-primary"/> 素材库 / ASSETS</span>
                                    <span className="text-[10px] font-mono text-neon-secondary bg-neon-secondary/10 px-3 py-1 border border-neon-secondary/20">需要: 4-8 张图片</span>
                                </h2>
                                <div className="h-64 mb-10">
                                    <ImageUploader 
                                        images={state.product.images} 
                                        onImagesChange={(imgs) => handleProductUpdate('images', imgs)} 
                                        onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                                        label="产品图片"
                                        compact={true}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/5">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><User size={14} className="text-neon-blue"/> 指定模特</div>
                                        <div className="h-32"><ImageUploader images={state.product.modelImages} onImagesChange={(imgs) => handleProductUpdate('modelImages', imgs)} onPreview={(url) => setPreviewMedia({url, type: 'image'})} maxImages={4} gridCols={2} compact={true}/></div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><ImageIcon size={14} className="text-neon-primary"/> 指定背景</div>
                                        <div className="h-32"><ImageUploader images={state.product.backgroundImages} onImagesChange={(imgs) => handleProductUpdate('backgroundImages', imgs)} onPreview={(url) => setPreviewMedia({url, type: 'image'})} maxImages={2} gridCols={2} compact={true}/></div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><Video size={14} className="text-neon-secondary"/> 参考视频</div>
                                        <div className="h-32"><VideoUploader video={state.product.referenceVideo} onVideoChange={(v) => handleProductUpdate('referenceVideo', v)}/></div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={startAnalysis}
                                disabled={state.isAnalyzing}
                                className="w-full py-6 bg-neon-primary hover:bg-neon-primary/80 text-white font-bold text-lg uppercase tracking-[0.2em] rounded-sm shadow-[0_0_30px_rgba(124,58,237,0.3)] transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:grayscale group border border-white/10 hover:border-white/30"
                            >
                                <Cpu className="group-hover:animate-spin-slow" /> 启动神经生成序列 / INITIALIZE
                            </button>
                        </div>
                    </div>
                </div>

                {/* STEP 2: WORKSPACE */}
                <div className={state.activeStep === 1 ? 'block animate-in fade-in zoom-in-95 duration-500' : 'hidden'}>
                     <div className="flex flex-col xl:flex-row gap-8">
                        {/* Strategy HUD */}
                        <div className="xl:w-80 flex-shrink-0 space-y-4">
                            <div className="glass-panel p-6 rounded-sm border-l-2 border-neon-secondary sticky top-6">
                                <h2 className="text-xs font-bold text-neon-secondary uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Bot size={16} /> 策略分析 / STRATEGY
                                </h2>
                                {state.analysis && (
                                    <div className="space-y-6 font-mono text-xs">
                                        <div className="bg-void-800 p-4 border border-white/5 relative overflow-hidden">
                                            <div className="text-slate-500 mb-2 font-bold">核心策略 / CORE</div>
                                            <div className="text-white leading-relaxed z-10 relative">{state.analysis.strategy}</div>
                                            <div className="absolute -right-4 -bottom-4 text-void-700 opacity-20"><Activity size={64}/></div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 mb-1 font-bold">黄金三秒 / HOOK</div>
                                            <div className="text-neon-primary border-l-2 border-neon-primary pl-2 italic">"{state.analysis.hook}"</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 mb-1 font-bold">目标受众 / AUDIENCE</div>
                                            <div className="text-slate-300">{state.analysis.targetAudience}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 mb-1 font-bold">配音风格 / VOICE</div>
                                            <div className="text-neon-secondary bg-neon-secondary/10 inline-block px-2 py-0.5 border border-neon-secondary/30">{state.analysis.assignedVoice}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Storyboard */}
                        <div className="flex-1 space-y-8">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div>
                                    <h2 className="text-2xl font-light text-white tracking-tight">时间轴序列 <span className="text-neon-primary">V4.0</span></h2>
                                    <p className="text-[10px] font-mono text-slate-500 tracking-wider mt-1">TIMELINE SEQUENCE / GENERATION MATRIX</p>
                                </div>
                                <div className="text-xs font-mono text-neon-secondary bg-void-800 px-4 py-1.5 border border-neon-secondary/20 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-neon-secondary rounded-full animate-pulse"></div>
                                    {state.settings.videoMode.toUpperCase()} 模式
                                </div>
                            </div>
                            
                            <Storyboard 
                                scenes={state.storyboard} 
                                videoMode={state.settings.videoMode}
                                aspectRatio={state.settings.aspectRatio}
                                resolution={state.settings.imageResolution}
                                productImages={state.product.images}
                                modelImages={state.product.modelImages}
                                backgroundImages={state.product.backgroundImages}
                                assignedVoice={state.analysis?.assignedVoice || 'Kore'}
                                onUpdateScene={updateScene}
                                onPreview={(url, type) => setPreviewMedia({url, type})}
                            />
                        </div>
                     </div>
                </div>

            </div>
        </main>

        {/* Media Modal */}
        {previewMedia && (
            <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8" onClick={() => setPreviewMedia(null)}>
                <button className="absolute top-8 right-8 text-white hover:text-neon-primary transition-colors"><X size={32} /></button>
                <div className="max-w-7xl max-h-full border border-neon-primary/30 shadow-[0_0_100px_rgba(124,58,237,0.3)] bg-void-900 relative" onClick={e => e.stopPropagation()}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-primary via-neon-secondary to-neon-primary animate-scan"></div>
                    {previewMedia.type === 'image' ? (
                        <img src={previewMedia.url} className="max-h-[85vh] w-auto" />
                    ) : (
                        <div className="bg-void-900 p-24 border border-white/10 flex flex-col items-center gap-8">
                            <div className="w-32 h-32 rounded-full bg-neon-primary/10 flex items-center justify-center animate-pulse border border-neon-primary/50">
                                <Radio className="w-12 h-12 text-neon-primary" />
                            </div>
                            <audio src={previewMedia.url} controls className="w-96 contrast-150" />
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </HashRouter>
  );
}

const NavButton = ({ active, onClick, icon, label, subLabel, disabled }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full p-4 flex lg:flex-row flex-col items-center gap-4 transition-all duration-300 relative group mb-2 ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
    >
        <div className={`p-2 rounded-md transition-colors ${active ? 'bg-neon-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]' : 'text-slate-500 group-hover:text-white'}`}>
            {icon}
        </div>
        <div className="hidden lg:block text-left">
            <div className={`text-sm font-bold tracking-wide ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{label}</div>
            <div className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">{subLabel}</div>
        </div>
        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-primary shadow-[0_0_10px_#7c3aed]"></div>}
    </button>
)

export default App;
