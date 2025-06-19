document.addEventListener('DOMContentLoaded', () => {
    try {
        const startButton = document.getElementById('start-button');
        const stopButton = document.getElementById('stop-button');
        const buttonText = document.querySelector('.button-text');
        const container = document.querySelector('.container');
        const phaseLabel = document.getElementById('phase-label');
        const speedValueMain = document.getElementById('speed-value-main');
        const waveformCanvas = document.getElementById('waveform-canvas');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        // Result elements
        const pingValue = document.getElementById('ping-value');
        const jitterValue = document.getElementById('jitter-value');
        const downloadValue = document.getElementById('download-value');
        const uploadValue = document.getElementById('upload-value');
        
        // Result boxes for active states
        const pingBox = document.querySelector('.ping-box');
        const jitterBox = document.querySelector('.jitter-box');
        const downloadBox = document.querySelector('.download-box');
        const uploadBox = document.querySelector('.upload-box');
        const readoutLabel = document.querySelector('.readout-label');

        let isTestRunning = false;
        let isStopping = false;
        let currentPhase = '';
        let testResults = {
            download: '--',
            upload: '--',
            ping: '--',
            jitter: '--'
        };

        class WaveformChart {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.data = [];
                this.maxDataPoints = 60;
                this.currentPhase = 'download';
                this.animationFrame = null;
                this.isRunning = false;
                this.setupCanvas();
            }

            setupCanvas() {
                const rect = this.canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                
                this.canvas.width = rect.width * dpr;
                this.canvas.height = rect.height * dpr;
                
                this.ctx.scale(dpr, dpr);
                this.canvas.style.width = rect.width + 'px';
                this.canvas.style.height = rect.height + 'px';
            }

            addDataPoint(value) {
                if (!this.isRunning) return;
                this.data.push(value);
                if (this.data.length > this.maxDataPoints) {
                    this.data.shift();
                }
            }

            setPhase(phase) {
                this.currentPhase = phase;
            }

            getPhaseColor() {
                switch (this.currentPhase) {
                    case 'download': return '#48bb78';
                    default: return '#667eea';
                }
            }

            start() {
                this.isRunning = true;
                this.startAnimation();
            }

            stop() {
                this.isRunning = false;
                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }
            }

            startAnimation() {
                if (!this.isRunning) return;
                
                const animate = () => {
                    if (!this.isRunning) return;
                    this.draw();
                    this.animationFrame = requestAnimationFrame(animate);
                };
                animate();
            }

            draw() {
                if (!this.isRunning) return;
                
                const width = this.canvas.clientWidth;
                const height = this.canvas.clientHeight;
                
                this.ctx.clearRect(0, 0, width, height);
                
                if (this.data.length < 2) return;

                const maxValue = Math.max(...this.data, 1);
                const stepX = width / (this.maxDataPoints - 1);
                const color = this.getPhaseColor();

                const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, color + '30');
                gradient.addColorStop(0.5, color + '15');
                gradient.addColorStop(1, color + '05');
                
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.moveTo(0, height);
                
                for (let i = 0; i < this.data.length; i++) {
                    const x = i * stepX;
                    const y = height - (this.data[i] / maxValue) * height * 0.85;
                    
                    if (i === 0) {
                        this.ctx.lineTo(x, y);
                    } else {
                        const prevX = (i - 1) * stepX;
                        const prevY = height - (this.data[i - 1] / maxValue) * height * 0.85;
                        const cpX = (prevX + x) / 2;
                        this.ctx.quadraticCurveTo(cpX, prevY, x, y);
                    }
                }
                
                this.ctx.lineTo((this.data.length - 1) * stepX, height);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 10;
                
                this.ctx.beginPath();
                for (let i = 0; i < this.data.length; i++) {
                    const x = i * stepX;
                    const y = height - (this.data[i] / maxValue) * height * 0.85;
                    
                    if (i === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        const prevX = (i - 1) * stepX;
                        const prevY = height - (this.data[i - 1] / maxValue) * height * 0.85;
                        const cpX = (prevX + x) / 2;
                        this.ctx.quadraticCurveTo(cpX, prevY, x, y);
                    }
                }
                this.ctx.stroke();

                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;

                this.ctx.fillStyle = color;
                for (let i = 0; i < this.data.length; i++) {
                    const x = i * stepX;
                    const y = height - (this.data[i] / maxValue) * height * 0.85;
                    const radius = i === this.data.length - 1 ? 4 : 2;
                    
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    if (i === this.data.length - 1) {
                        this.ctx.strokeStyle = '#ffffff';
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();
                    }
                }
            }

            reset() {
                this.stop();
                this.data = [];
                this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
            }

            destroy() {
                this.stop();
                this.data = [];
            }
        }


        const waveform = new WaveformChart(waveformCanvas);
        const setUIState = (state) => {
            if (isStopping && state !== 'ready' && state !== 'stopping') {
                return;
            }

            container.className = `container ${state}`;
            
            switch (state) {
                case 'testing':
                    buttonText.textContent = 'GO';
                    startButton.classList.remove('testing', 'stopping');
                    stopButton.classList.remove('hidden');
                    stopButton.disabled = false;
                    stopButton.style.opacity = '1';
                    isTestRunning = true;
                    isStopping = false;
                    waveform.start();
                    break;
                    
                case 'stopping':
                    progressText.textContent = 'Stopping test...';
                    stopButton.disabled = true;
                    stopButton.style.opacity = '0.6';
                    isStopping = true;
                    waveform.stop();
                    break;
                    
                case 'finished':
                    buttonText.textContent = '';
                    startButton.classList.remove('testing', 'stopping');
                    stopButton.classList.add('hidden');
                    startButton.disabled = false;
                    isTestRunning = false;
                    isStopping = false;
                    progressText.textContent = 'Test Complete';
                    progressFill.style.width = '100%';
                    waveform.stop();
                    
                    setTimeout(() => {
                        if (!isTestRunning && !isStopping) {
                            speedValueMain.textContent = testResults.download;
                            phaseLabel.textContent = 'DOWNLOAD';
                            readoutLabel.className = 'readout-label download';
                        }
                    }, 500);
                    
                    setTimeout(() => {
                        if (!isTestRunning && !isStopping) {
                            setUIState('ready');
                        }
                    }, 5000);
                    break;
                    
                case 'error':
                    buttonText.textContent = '';
                    startButton.classList.remove('testing', 'stopping');
                    stopButton.classList.add('hidden');
                    startButton.disabled = false;
                    isTestRunning = false;
                    isStopping = false;
                    progressText.textContent = 'Test Failed';
                    progressFill.style.width = '0%';
                    waveform.stop();
                    break;
                    
                default: 
                    buttonText.textContent = 'GO';
                    startButton.classList.remove('testing', 'stopping');
                    stopButton.classList.add('hidden');
                    stopButton.disabled = false;
                    stopButton.style.opacity = '1';
                    startButton.disabled = false;
                    isTestRunning = false;
                    isStopping = false;
                    clearActiveStates();
                    resetDisplay();
                    waveform.reset();
            }
        };

        const resetDisplay = () => {
            speedValueMain.textContent = '0.00';
            phaseLabel.textContent = 'DOWNLOAD';
            readoutLabel.className = 'readout-label';
            progressText.textContent = 'Ready to test';
            progressFill.style.width = '0%';
            currentPhase = '';
            
            pingValue.textContent = '--';
            jitterValue.textContent = '--';
            downloadValue.textContent = '--';
            uploadValue.textContent = '--';
            
            testResults = {
                download: '--',
                upload: '--',
                ping: '--',
                jitter: '--'
            };
        };

        const clearActiveStates = () => {
            [pingBox, jitterBox, downloadBox, uploadBox].forEach(box => {
                box.classList.remove('active');
            });
        };

        const setActivePhase = (phase) => {

            if (phase !== 'download' || !isTestRunning || isStopping) {
                return;
            }
            
            clearActiveStates();
            currentPhase = phase;
            readoutLabel.className = `readout-label ${phase}`;
            
            phaseLabel.textContent = 'DOWNLOAD';
            downloadBox.classList.add('active');
            progressText.textContent = 'Testing download speed...';
            
            waveform.setPhase(phase);
        };

        const updateProgress = (phase, progress = 0) => {
            if (!isTestRunning || isStopping) return;
            
            let phaseProgress = 0;
            
            switch (phase) {
                case 'download':
                    phaseProgress = progress * 100;
                    break;
                default:
                    phaseProgress = 100;
            }
            
            progressFill.style.width = `${Math.min(phaseProgress, 100)}%`;
        };


        const initializeUI = async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'getTestState' });
                if (response && response.isRunning) {
                    setUIState('testing');
                    if (response.testData) {
                        updateUIWithTestData(response.testData);
                    }
                } else {
                    setUIState('ready');
                }
            } catch (error) {
                console.warn('Could not get test state:', error);
                setUIState('ready');
            }
        };

        const updateUIWithTestData = (data) => {
            if (!isTestRunning || isStopping) return;
            
            if (data.testState === 'download' && data.dlStatus) {
                setActivePhase('download');
                const speed = parseFloat(data.dlStatus) || 0;
                speedValueMain.textContent = speed.toFixed(2);
                downloadValue.textContent = speed.toFixed(2);
                testResults.download = speed.toFixed(2);
                waveform.addDataPoint(speed);
                updateProgress('download', Math.min(speed / 100, 1));
                
            } else if (data.testState === 'upload' && data.ulStatus) {

                testResults.upload = parseFloat(data.ulStatus).toFixed(2);
                uploadValue.textContent = testResults.upload;
                
            } else if (data.testState === 'ping' || data.testState === 'latency') {

                if (data.pingStatus) {
                    testResults.ping = parseFloat(data.pingStatus).toFixed(2);
                    pingValue.textContent = testResults.ping;
                }
            }
        };

        const handleStopTest = async () => {
            if (isStopping || !isTestRunning) {
                return;
            }

            console.log('Stop button clicked - initiating stop sequence');
            
            setUIState('stopping');
            
            try {
                await chrome.runtime.sendMessage({ type: 'stopTest' });
                console.log('Stop message sent successfully');
                
                setTimeout(() => {
                    console.log('Forcing UI reset to ready state');
                    setUIState('ready');
                }, 800);
                
            } catch (error) {
                console.error('Error stopping test:', error);
                setTimeout(() => {
                    setUIState('ready');
                }, 500);
            }
        };

        const handleStartTest = async () => {
            if (isTestRunning || isStopping) {
                return;
            }

            console.log('Start button clicked - initiating test');
            

            testResults = { download: '--', upload: '--', ping: '--', jitter: '--' };
            resetDisplay();
            setUIState('testing');
            progressText.textContent = 'Initializing test...';
            
            try {
                await chrome.runtime.sendMessage({ type: 'startTest' });
            } catch (error) {
                console.error('Error starting test:', error);
                setUIState('error');
            }
        };

  
        startButton.addEventListener('click', handleStartTest);
        stopButton.addEventListener('click', handleStopTest);


        chrome.runtime.onMessage.addListener((message) => {
            try {
                const { type, data } = message;

                if (isStopping && type !== 'stopped') {
                    return;
                }

                if (type === 'update') {
                    updateUIWithTestData(data);
                } else if (type === 'end') {
                    if (!isStopping) {
                        testResults.download = data.dl;
                        testResults.upload = data.ul;
                        testResults.ping = data.ping;
                        testResults.jitter = data.jitter;
                        
                        downloadValue.textContent = testResults.download;
                        uploadValue.textContent = testResults.upload;
                        pingValue.textContent = testResults.ping;
                        jitterValue.textContent = testResults.jitter;
                        
                        setUIState('finished');
                        
                    
                        const boxes = [downloadBox, uploadBox, pingBox, jitterBox];
                        boxes.forEach((box, index) => {
                            setTimeout(() => {
                                if (!isStopping) {
                                    box.classList.add('active');
                                }
                            }, index * 150);
                        });
                    }
                } else if (type === 'error') {
                    if (!isStopping) {
                        setUIState('error');
                        progressText.textContent = data || 'Test failed';
                    }
                } else if (type === 'stopped') {
                    console.log('Received stop confirmation from background');
                    setUIState('ready');
                }
            } catch (error) {
                console.error('Error handling message:', error);
                if (!isStopping) {
                    setUIState('error');
                }
            }
        });


        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (isTestRunning) {
                    handleStopTest();
                } else {
                    handleStartTest();
                }
            } else if (e.code === 'Escape' && isTestRunning) {
                e.preventDefault();
                handleStopTest();
            } else if (e.code === 'KeyR' && !isTestRunning && !isStopping) {
                e.preventDefault();
                handleStartTest();
            }
        });

        window.addEventListener('resize', () => {
            waveform.setupCanvas();
        });

        window.addEventListener('beforeunload', () => {
            waveform.destroy();
        });


        initializeUI();

    } catch (error) {
        console.error("Critical UI Error:", error);
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #f56565; background: #0a0e1a; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
                <h3 style="margin: 0 0 10px; color: #f7fafc;">Extension Error</h3>
                <p style="margin: 0; color: #a0aec0;">Please reload the extension</p>
            </div>
        `;
    }
});
