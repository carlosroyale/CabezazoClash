export class AudioManager {
    constructor({ musicVolume = 0.5, effectsVolume = 1.0 } = {}) {
        this.ctx = null;
        this.audioData = new Map();
        this.buffers = new Map();
        this.loopSources = new Map();
        this.musicVolume = musicVolume;
        this.effectsVolume = effectsVolume;
    }

    getContext() {
        if (!this.ctx || this.ctx.state === 'closed') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            this.buffers.clear();
            this.loopSources.clear();
        }

        return this.ctx;
    }

    async unlock() {
        const ctx = this.getContext();

        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            try {
                await ctx.resume();
            } catch (e) {
                console.warn('No se pudo reanudar el audio', e);
            }
        }
    }

    async load(name, url) {
        if (this.audioData.has(name)) return;

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.audioData.set(name, arrayBuffer);
    }

    async getBuffer(name) {
        if (this.buffers.has(name)) {
            return this.buffers.get(name);
        }

        const data = this.audioData.get(name);
        if (!data) return null;

        const ctx = this.getContext();
        const buffer = await ctx.decodeAudioData(data.slice(0));
        this.buffers.set(name, buffer);

        return buffer;
    }

    async play(name, { volume = 1, loop = false, type = 'effect' } = {}) {
        await this.unlock();

        if (loop && this.loopSources.has(name)) {
            return this.loopSources.get(name);
        }

        const buffer = await this.getBuffer(name);
        if (!buffer) return null;

        const ctx = this.getContext();
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();

        source.buffer = buffer;
        source.loop = loop;
        gain.gain.value = this.getFinalVolume(volume, type);

        source.connect(gain);
        gain.connect(ctx.destination);

        source.onended = () => {
            if (this.loopSources.get(name)?.source === source) {
                this.loopSources.delete(name);
            }
        };

        source.start(0);

        if (loop) {
            this.loopSources.set(name, { source, gain, volume, type });
        }

        return { source, gain };
    }

    stopLoop(name) {
        const item = this.loopSources.get(name);
        if (!item) return;

        try {
            item.source.stop();
        } catch (e) {}

        this.loopSources.delete(name);
    }

    isLoopPlaying(name) {
        return this.loopSources.has(name);
    }

    setMusicVolume(value) {
        this.musicVolume = value;

        for (const item of this.loopSources.values()) {
            if (item.type === 'music') {
                item.gain.gain.value = this.getFinalVolume(item.volume, item.type);
            }
        }
    }

    setEffectsVolume(value) {
        this.effectsVolume = value;

        for (const item of this.loopSources.values()) {
            if (item.type !== 'music') {
                item.gain.gain.value = this.getFinalVolume(item.volume, item.type);
            }
        }
    }

    setLoopVolume(name, volume) {
        const item = this.loopSources.get(name);
        if (!item) return;

        item.volume = volume;
        item.gain.gain.value = this.getFinalVolume(item.volume, item.type);
    }

    setLoopPlaybackRate(name, playbackRate) {
        const item = this.loopSources.get(name);
        if (!item) return;

        item.source.playbackRate.value = playbackRate;
    }

    getFinalVolume(volume, type) {
        return volume * (type === 'music' ? this.musicVolume : this.effectsVolume);
    }

    suspend() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    }

    resume() {
        return this.unlock();
    }
}
