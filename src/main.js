import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- CONFIG ---
const TEXTURES = {
    ceres: 'textures/ceres.jpg',
    stars: 'textures/stars_8k.jpg'
};

// Curation of "Cinematic Cosmic" hues
const COSMIC_COLORS = [
    0x2E0854, // Deep Midnight Purple
    0x4B0082, // Indigo Nebula
    0x00F5FF, // Electric Cyan
    0x7B68EE, // Medium Slate Blue
    0xFF69B4, // Aurora Pink
    0xFFD700, // Ethereal Gold
    0x00FA9A  // Soft Spring Green
];

// --- AUDIO ENGINE ---
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isStarted = false;
        this.scale = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
    }

    async init() {
        if (this.isStarted) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.15;
        this.master.connect(this.ctx.destination);
        this.isStarted = true;
    }

    playNote(x, y) {
        if (!this.isStarted) return;
        const freq = this.scale[Math.floor(x * this.scale.length)];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const panner = this.ctx.createPanner();
        
        panner.panningModel = 'equalpower';
        panner.setPosition((x - 0.5) * 2, (0.5 - y) * 2, 0);

        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 8);
        
        osc.connect(g);
        g.connect(panner);
        panner.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 8.1);
    }
}

// --- VISUAL ENGINE ---
class SceneManager {
    constructor() {
        this.container = document.getElementById('app');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.controls = null;
        this.composer = null;
        this.planet = null;
        this.echos = [];
        this.stardust = [];
        this.init();
    }

    init() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 5, 35);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.03;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.03;

        const loader = new THREE.TextureLoader();

        // High-Contrast Starfield
        loader.load(TEXTURES.stars, (tex) => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = tex;
        });

        // Planet
        const planetTex = loader.load(TEXTURES.ceres);
        this.planet = new THREE.Mesh(
            new THREE.SphereGeometry(5, 64, 64),
            new THREE.MeshStandardMaterial({ map: planetTex, bumpMap: planetTex, bumpScale: 0.1, roughness: 1 })
        );
        this.scene.add(this.planet);

        // Lighting
        const sun = new THREE.DirectionalLight(0xfff5e1, 2.5);
        sun.position.set(-25, 15, 20);
        this.scene.add(sun);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.02));

        // Post-Processing
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.2, 0.9);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);

        window.addEventListener('resize', () => this.onResize());
        this.animate();
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w/h; this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h); this.composer.setSize(w, h);
    }

    createSoftCircleTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64,64,0,64,64,64);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        return new THREE.CanvasTexture(canvas);
    }

    createEcho(x, y) {
        // Use a raycaster to find a point at a fixed distance from the camera
        const raycaster = new THREE.Raycaster();
        const mousePos = new THREE.Vector2((x * 2) - 1, -(y * 2) + 1);
        raycaster.setFromCamera(mousePos, this.camera);
        
        // Position the FX exactly 15 units in front of the camera focus
        const pos = new THREE.Vector3();
        raycaster.ray.at(20, pos);

        const color = COSMIC_COLORS[Math.floor(x * COSMIC_COLORS.length)];
        const glowTex = this.createSoftCircleTexture();

        // 1. Expanding Halo (Soft and Ethereal)
        const spriteMat = new THREE.SpriteMaterial({ 
            map: glowTex, 
            color: color, 
            transparent: true, 
            opacity: 0.3, 
            blending: THREE.AdditiveBlending 
        });
        const halo = new THREE.Sprite(spriteMat);
        halo.position.copy(pos);
        halo.scale.set(1, 1, 1);
        this.scene.add(halo);
        this.echos.push({ mesh: halo, scale: 1, opacity: 0.3 });

        // 2. Slow Stardust Drift
        for(let i=0; i<3; i++) {
            const pMat = new THREE.SpriteMaterial({ map: glowTex, color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
            const p = new THREE.Sprite(pMat);
            p.position.copy(pos);
            p.scale.set(0.2, 0.2, 1);
            p.userData.velocity = new THREE.Vector3((Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02);
            this.scene.add(p);
            this.stardust.push({ mesh: p, life: 1.0 });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update Echos
        this.echos.forEach((e, i) => {
            e.scale += 0.2;
            e.opacity -= 0.003;
            e.mesh.scale.set(e.scale, e.scale, 1);
            e.mesh.material.opacity = e.opacity;
            if(e.opacity <= 0) {
                this.scene.remove(e.mesh);
                this.echos.splice(i, 1);
            }
        });

        // Update Stardust
        this.stardust.forEach((p, i) => {
            p.mesh.position.add(p.mesh.userData.velocity);
            p.life -= 0.004;
            p.mesh.material.opacity = p.life;
            if(p.life <= 0) {
                this.scene.remove(p.mesh);
                this.stardust.splice(i, 1);
            }
        });

        this.controls.update();
        if (this.planet) this.planet.rotation.y += 0.0002;
        this.composer.render();
    }
}

// Start
const audio = new AudioEngine();
const visuals = new SceneManager();

document.getElementById('start-btn').addEventListener('click', async () => {
    await audio.init();
    document.getElementById('overlay').classList.add('hidden');
});

window.addEventListener('mousedown', (e) => {
    if (!document.getElementById('overlay').classList.contains('hidden')) return;
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    audio.playNote(x, y);
    visuals.createEcho(x, y);
});
