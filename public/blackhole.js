// The Black Hole behind the HUD. It only draws: sound still plays through a normal <audio> element, so a graphics problem can never silence SB.
(() => {
const FS_VERT=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
const COMMON=`#version 300 es
precision highp float;
uniform vec2 uRes,uCenter,uMouse;uniform float uT,uR,uL,uPulse,uSpin,uWave;uniform vec4 uS;out vec4 o;
const float PI=3.14159265;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float h3(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p,int k){float v=0.,a=.5;for(int i=0;i<k;i++){v+=a*n3(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}
vec3 fire(float t){t=clamp(t,0.,1.);return mix(mix(vec3(.16,.035,.008),vec3(.95,.46,.07),smoothstep(0.,.42,t)),mix(vec3(1.,.76,.26),vec3(1.,.97,.84),smoothstep(.72,1.,t)),smoothstep(.36,.76,t));}
void finish(vec3 c,float a,vec2 p){float r=length(p),q=uPulse;if(q>0.){float R=(1.-q)*2.3+.2,e=exp(-pow((r-R)*16.,2.))*q*q;c+=vec3(1.,.8,.42)*e*.34;a=max(a,e*.5);}
c=1.-exp(-c*1.55);c=pow(c,vec3(.92));c+=(h3(vec3(gl_FragCoord.xy,uT))-.5)/200.;float m=max(max(c.r,c.g),c.b);a=max(a,smoothstep(0.,.24,m));o=vec4(clamp(c,0.,1.),a);if(a<1.)o.rgb=min(o.rgb,vec3(a));}
vec2 P(){return (gl_FragCoord.xy-uCenter)/uR;}`;

const HOLE=COMMON+`
// The swirl is sampled at two phases and cross-faded, so the pattern never winds up into thin stripes however long SB stays open.
float swirl(float a,float d,float ph){float w=a+ph*2.5/pow(d,1.5);vec3 q=vec3(d*2.7,cos(w)*1.75,sin(w)*1.75);return fbm(q+vec3(0,0,uT*.035),4);}
void main(){vec2 p=P();float L=length(p);if(L>2.95){finish(vec3(0),0.,p);return;}
 float el=-.05+uMouse.y*.03+sin(uT*.13)*.013+uS.z*.01-uS.y*.008;mat2 X=rot(el),Y=rot(uMouse.x*.3+sin(uT*.07)*.05);
 vec3 ro=vec3(0,0,-9.4),rd=normalize(vec3(p*1.46,2.));ro.yz=X*ro.yz;rd.yz=X*rd.yz;ro.xz=Y*ro.xz;rd.xz=Y*rd.xz;
 vec3 q=ro,v=rd,c=vec3(0);float h2=dot(cross(q,v),cross(q,v)),A=0.,rmin=99.;bool hit=false;
 float T=10.,s1=fract(uSpin/T),s2=fract(uSpin/T+.5),mixA=1.-abs(2.*s1-1.);
 for(int i=0;i<64;i++){float r2=dot(q,q),r=sqrt(r2);rmin=min(rmin,r);if(r<1.02){hit=true;break;}if(r>14.&&dot(q,v)>0.)break;float dt=clamp(.07*r,.045,.62);
  vec3 prev=q;v+=-1.5*h2*q/pow(r2,2.5)*dt;q+=v*dt;
  if(prev.y*q.y<0.&&A<.97){vec3 x=mix(prev,q,prev.y/(prev.y-q.y));float d=length(x.xz);if(d>2.3&&d<7.6){float a=atan(x.z,x.x),n=mix(swirl(a,d,(s2-.5)*T),swirl(a,d,(s1-.5)*T),mixA);
    float edge=smoothstep(2.3,3.05,d)*pow(smoothstep(7.6,3.3,d),1.5),heat=pow(2.8/d,1.75),g=dot(normalize(vec3(-x.z,0.,x.x)),normalize(v)),beam=pow(1.+g*.33,2.4);
    float rip=pow(.5+.5*sin(d*2.7-uWave),3.)*uL,band=.62+.38*sin(d*9.+n*9.),den=smoothstep(.2,.72,n);
    float al=clamp(edge*(.3+den*.72),0.,1.)*(1.-A),I=(.34+den*1.02)*(.76+band*.24)*heat*beam*(1.+uL*.34+uS.y*.12+uS.z*.1)+rip*heat*.62;
    c+=fire(heat*(.5+den*.48)*min(beam,1.7)+rip*.2)*I*al*1.72;A+=al*.84;}}}
 if(!hit){float ring=exp(-max(rmin-1.5,0.)*8.5)*(1.-A*.72);c+=vec3(1.,.83,.52)*ring*(.92+uL*.32+uS.y*.18);c+=vec3(1.,.58,.18)*exp(-max(rmin-1.5,0.)*2.5)*.05*(1.-A);
  float sky=(1.-A)*smoothstep(2.9,1.5,L);if(sky>.01){vec3 d=normalize(v),g=floor(d*230.);float m=h3(g),t=step(.9978,m)*(.55+.45*sin(uT*1.4+m*90.))*smoothstep(.36,.06,length(fract(d*230.)-.5));c+=vec3(1.,.93,.8)*t*.75*sky;float neb=fbm(d*2.4+vec3(0,0,uT*.006),3);c+=mix(vec3(.018,.04,.1),vec3(.11,.06,.02),smoothstep(.34,.62,neb))*pow(neb,2.3)*.75*sky;}}
 c+=vec3(1.,.64,.24)*exp(-max(L-.42,0.)*3.5)*(.022+uL*.05+uS.y*.018+uS.z*.012);
 c+=vec3(1.,.72,.36)*exp(-abs(p.y)*30.)*exp(-abs(p.x)*1.25)*(.04+uL*.05);
 finish(c,hit?1.:clamp(A*1.3,0.,1.),p);}`;

const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches, STATES = ['idle', 'listening', 'thinking', 'speaking'];
let gl, cv, rig, prog, u, vao, running = false, state = 'idle', level = 0, env = 0, pulse = .7, time = 0, spin = 0, spinRate = .3, ripple = 0, scale = 1, W = 0, H = 0, cx = 0, cy = 0, rad = 200, last = 0, frames = 0, fpsAt = 0, st = [1, 0, 0, 0], mouse = [0, 0], mouseT = [0, 0], track = null, bars = [];
const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
function size() {
  if (!gl) return; const r = rig.getBoundingClientRect(), box = cv.getBoundingClientRect(), k = scale * Math.min(devicePixelRatio || 1, 1.5), w = Math.max(2, Math.round(box.width * k)), h = Math.max(2, Math.round(box.height * k));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } W = w; H = h; cx = (r.left + r.width / 2 - box.left) * k; cy = H - (r.top + r.height / 2 - box.top) * k; rad = Math.max(90, Math.min(r.width, r.height) / 2) * k * .92; gl.viewport(0, 0, W, H);
}
// Loudness is read from a decoded copy of the clip and followed by the audio's own clock.
async function follow(a, url) {
  const item = { a, env: null }; track = item; a.addEventListener('ended', () => { if (track === item) track = null; }, { once: true }); a.addEventListener('error', () => { if (track === item) track = null; }, { once: true });
  try {
    const raw = await (await fetch(url)).arrayBuffer(), buf = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(raw), d = buf.getChannelData(0), hop = Math.max(1, Math.floor(buf.sampleRate / 40)), e = new Float32Array(Math.ceil(d.length / hop));
    for (let i = 0; i < e.length; i++) { let s = 0, n = 0; for (let j = i * hop; j < Math.min(d.length, (i + 1) * hop); j++) { s += d[j] * d[j]; n++; } e[i] = Math.min(1, Math.sqrt(s / (n || 1)) * 5.2); }
    item.env = e;
  } catch {}
}
function loudness(t) {
  if (track?.env) return track.env[Math.min(track.env.length - 1, Math.floor(track.a.currentTime * 40))] || 0;
  if (state === 'speaking') return Math.max(0, .42 + .3 * Math.sin(t * .0062) * Math.sin(t * .0023) + .09 * Math.sin(t * .0131));
  return state === 'listening' ? .13 + .05 * Math.sin(t * .005) : 0;
}
function frame(t) {
  if (!running) return; requestAnimationFrame(frame); if (document.hidden) { last = t; return; }
  const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; frames++;
  if (t - fpsAt > 1500) { const fps = frames * 1000 / (t - fpsAt); frames = 0; fpsAt = t; window.__holeFps = Math.round(fps); if (fps < 24 && scale > .5) { scale = Math.max(.5, scale * .84); size(); } else if (fps > 52 && scale < 1) { scale = Math.min(1, scale * 1.07); size(); } }
  time += dt * (reduce ? .25 : 1); const target = loudness(t); env += (target - env) * (1 - Math.exp(-dt / (target > env ? .11 : .42))); level += (Math.pow(env, .82) - level) * (1 - Math.exp(-dt / .12)); pulse = Math.max(0, pulse - dt * .95);
  STATES.forEach((s, i) => { st[i] += ((s === state ? 1 : 0) - st[i]) * Math.min(1, dt * 3.2); }); mouse = mouse.map((v, i) => v + (mouseT[i] - v) * Math.min(1, dt * 2.6));
  const want = .3 + st[2] * .82 + st[3] * .16 + level * .24; spinRate += (want - spinRate) * (1 - Math.exp(-dt / .7)); if (!reduce) spin += dt * spinRate; ripple += dt * (1.15 + level * 1.5);
  bars.forEach((b, i) => { const c = Math.abs(i - 18) / 18, v = .08 + level * (1 - c * .72) * Math.abs(Math.sin(t * .0045 + i * .62) * .72 + Math.cos(t * .0027 + i * .31) * .36) + .035 * Math.sin(t * .002 + i * .5); b.style.transform = `scaleY(${Math.min(1, Math.max(.06, v)).toFixed(3)})`; });
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(prog); gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uCenter, cx, cy); gl.uniform2f(u.uMouse, mouse[0] * .5, mouse[1] * .5); gl.uniform1f(u.uT, time); gl.uniform1f(u.uR, rad); gl.uniform1f(u.uL, level); gl.uniform1f(u.uPulse, pulse); gl.uniform4f(u.uS, st[0], st[1], st[2], st[3]); gl.uniform1f(u.uSpin, spin); gl.uniform1f(u.uWave, ripple);
  gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function boot() {
  if (reduce || document.getElementById('holeBoot')) return; document.body.classList.add('booting');
  document.body.insertAdjacentHTML('beforeend', '<div id="holeBoot" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48"/><circle cx="50" cy="50" r="44"/></svg><p>SB online</p></div>');
  setTimeout(() => { document.getElementById('holeBoot')?.remove(); document.body.classList.remove('booting'); }, 2300);
}
// Returns false when the browser can't draw it, and SB then keeps its old animated design.
function start(rigEl) {
  if (running) return true; rig = rigEl;
  try {
    if (!gl) {
      cv = document.createElement('canvas'); cv.id = 'holeGl'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
      gl = cv.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' }); if (!gl) throw new Error('no webgl2');
      prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, FS_VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, HOLE)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      u = {}; for (const n of ['uRes', 'uCenter', 'uMouse', 'uT', 'uR', 'uL', 'uPulse', 'uS', 'uSpin', 'uWave']) u[n] = gl.getUniformLocation(prog, n); vao = gl.createVertexArray();
      const b = document.createElement('div'); b.id = 'holeBars'; b.setAttribute('aria-hidden', 'true'); for (let i = 0; i < 37; i++) b.append(document.createElement('i')); rig.after(b); bars = [...b.children];
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); gl = null; cv.remove(); b.remove(); window.dispatchEvent(new Event('sbholelost')); });
      addEventListener('pointermove', e => { if (e.pointerType !== 'touch') mouseT = [(e.clientX / innerWidth - .5) * 2, (.5 - e.clientY / innerHeight) * 2]; });
      let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(size, 100); }); addEventListener('scroll', size, { passive: true });
    }
  } catch (e) { console.error('black hole:', String(e.message).slice(0, 200)); try { cv?.remove(); } catch {} gl = null; return false; }
  document.body.classList.add('hole-gl'); size(); running = true; last = performance.now(); boot(); requestAnimationFrame(frame); return true;
}
function stop() { running = false; document.body.classList.remove('hole-gl'); }
window.SBHole = { start, stop, follow, get on() { return running; }, setState(s) { if (s !== state) { pulse = Math.max(pulse, .55); state = s; } }, debug: () => ({ state, level, fps: window.__holeFps || 0, scale }) };
})();
