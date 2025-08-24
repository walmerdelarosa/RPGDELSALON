import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

// --- Utilidades ---
const pastelBlueDark = "#2b3d5b"; // fondo solicitado
const colors = [
  "bg-red-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

let autoId = 1;

// --- Componente Canvas de Red con zoom/pan/drag ---
function CanvasNetwork({ characters, guilds, links, nodePositions, setNodePositions }) {
  const canvasRef = useRef(null);
  // transformaciones de vista
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const draggingNode = useRef(null);

  // Combinar nodos (personajes + gremios)
  const allNodes = [
    ...guilds.map((g) => ({ type: "guild", id: g.id, name: g.name, color: g.color })),
    ...characters.map((c) => ({ type: "char", id: c.id, name: c.name, image: c.image })),
  ];

  // Asegurar posiciones por defecto
  useEffect(() => {
    if (!allNodes.length) return;
    setNodePositions((prev) => {
      const next = { ...prev };
      const gap = 160;
      let i = 0;
      allNodes.forEach((n) => {
        if (!next[n.id]) {
          next[n.id] = { x: (i % 8) * gap + 200, y: Math.floor(i / 8) * gap + 150 };
          i++;
        }
      });
      return next;
    });
  }, [characters, guilds]);

  // Dibujo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== cssW * DPR || canvas.height !== cssH * DPR) {
      canvas.width = cssW * DPR;
      canvas.height = cssH * DPR;
    }
    ctx.save();
    ctx.scale(DPR, DPR);

    // Fondo del canvas
    ctx.fillStyle = "#0f172a22"; // leve contraste sobre el azul del body
    ctx.fillRect(0, 0, cssW, cssH);

    // aplicar transformaciones
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Aristas
    ctx.lineWidth = 2 / Math.max(scale, 1);
    ctx.strokeStyle = "#cbd5e1";
    links.forEach((lk) => {
      const a = nodePositions[lk.from];
      const b = nodePositions[lk.to];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    // Nodos (gremios primero)
    const drawNode = (n) => {
      const p = nodePositions[n.id];
      if (!p) return;
      if (n.type === "guild") {
        const r = 26;
        ctx.beginPath();
        ctx.fillStyle = n.color || "#38bdf8";
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 3 / Math.max(scale, 1);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0b1220";
        ctx.font = `${14 / Math.max(scale, 1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.name || "Gremio", p.x, p.y - (r + 8));
      } else {
        const r = 22;
        // círculo base
        ctx.beginPath();
        ctx.fillStyle = "#e2e8f0";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2 / Math.max(scale, 1);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // imagen si hay
        if (n.image) {
          const image = new Image();
          image.src = n.image;
          image.onload = () => {
            const canvas2 = canvasRef.current;
            if (!canvas2) return;
            const c2 = canvas2.getContext("2d");
            c2.save();
            c2.translate(offset.x, offset.y);
            c2.scale(scale, scale);
            c2.beginPath();
            c2.arc(p.x, p.y, r - 3, 0, Math.PI * 2);
            c2.clip();
            c2.drawImage(image, p.x - (r - 3), p.y - (r - 3), (r - 3) * 2, (r - 3) * 2);
            c2.restore();
          };
        }
        // nombre
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${12 / Math.max(scale, 1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.name || "Personaje", p.x, p.y - (r + 8));
      }
    };

    allNodes
      .filter((n) => n.type === "guild")
      .forEach(drawNode);
    allNodes
      .filter((n) => n.type === "char")
      .forEach(drawNode);

    ctx.restore();
  }, [characters, guilds, links, nodePositions, scale, offset]);

  // util: transformar coordenadas de pantalla a mundo
  const toWorld = (x, y) => {
    return {
      x: (x - offset.x) / scale,
      y: (y - offset.y) / scale,
    };
  };

  // detección de nodo cercano
  const hitNode = (wx, wy) => {
    const radius = 26; // aprox
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const n = allNodes[i];
      const p = nodePositions[n.id];
      if (!p) continue;
      const dx = wx - p.x;
      const dy = wy - p.y;
      if (dx * dx + dy * dy <= radius * radius) return n;
    }
    return null;
  };

  // Eventos de interacción
  const onWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - offset.x) / scale;
    const wy = (my - offset.y) / scale;
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    const newScale = Math.min(4, Math.max(0.25, scale * factor));
    // mantener el punto del mouse fijo
    const newOffset = {
      x: mx - wx * newScale,
      y: my - wy * newScale,
    };
    setScale(newScale);
    setOffset(newOffset);
  };

  const onMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    const n = hitNode(w.x, w.y);
    if (n) {
      draggingNode.current = n;
    } else {
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onMouseMove = (e) => {
    if (draggingNode.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = toWorld(sx, sy);
      setNodePositions((prev) => ({
        ...prev,
        [draggingNode.current.id]: { x: w.x, y: w.y },
      }));
    } else if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    }
  };

  const onMouseUp = () => {
    draggingNode.current = null;
    isPanning.current = false;
  };

  return (
    <div className="w-full h-[70vh] md:h-[78vh] rounded-2xl overflow-hidden border border-slate-600 shadow-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
    </div>
  );
}

export default function RPGNetwork() {
  const [characters, setCharacters] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [links, setLinks] = useState([]); // {from: charId|guildId, to: guildId|charId}
  const [nodePositions, setNodePositions] = useState({}); // id -> {x,y}

  const [newChar, setNewChar] = useState({
    id: null,
    name: "",
    description: "",
    image: null,
    guildId: "",
    qualities: {
      Sociabilidad: 0,
      Humor: 0,
      Fuerza: 0,
      Potencial: 0,
      Inteligencia: 0,
    },
  });
  const [extraQualities, setExtraQualities] = useState([]);

  const [newGuild, setNewGuild] = useState({ name: "", color: "#38bdf8" });

  // --- Handlers Personajes ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNewChar({ ...newChar, image: ev.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQualityChange = (quality, value) => {
    setNewChar({
      ...newChar,
      qualities: {
        ...newChar.qualities,
        [quality]: Math.max(0, Math.min(100, parseInt(value) || 0)),
      },
    });
  };

  const addCharacter = () => {
    if (newChar.name.trim() === "") return;
    const id = `char_${autoId++}`;
    const char = { ...newChar, id };
    setCharacters((prev) => [...prev, char]);
    if (char.guildId) {
      setLinks((prev) => [...prev, { from: id, to: char.guildId }]);
    }
    setNewChar({
      id: null,
      name: "",
      description: "",
      image: null,
      guildId: "",
      qualities: {
        Sociabilidad: 0,
        Humor: 0,
        Fuerza: 0,
        Potencial: 0,
        Inteligencia: 0,
      },
    });
    setExtraQualities([]);
  };

  const removeCharacter = (id) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id));
    setNodePositions((prev) => {
      const p = { ...prev };
      delete p[id];
      return p;
    });
  };

  const addExtraQuality = () => {
    const newQuality = prompt("Nombre de la nueva cualidad:");
    if (newQuality && !extraQualities.includes(newQuality)) {
      setExtraQualities([...extraQualities, newQuality]);
      setNewChar({
        ...newChar,
        qualities: { ...newChar.qualities, [newQuality]: 0 },
      });
    }
  };

  // --- Handlers Gremios ---
  const addGuild = () => {
    if (!newGuild.name.trim()) return;
    const id = `guild_${autoId++}`;
    const g = { id, name: newGuild.name, color: newGuild.color };
    setGuilds((prev) => [...prev, g]);
    setNewGuild({ name: "", color: "#38bdf8" });
  };

  const removeGuild = (id) => {
    setGuilds((prev) => prev.filter((g) => g.id !== id));
    setLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id));
    setNodePositions((prev) => {
      const p = { ...prev };
      delete p[id];
      return p;
    });
    // quitar asignación de personajes a ese gremio
    setCharacters((prev) => prev.map((c) => (c.guildId === id ? { ...c, guildId: "" } : c)));
  };

  const assignCharToGuild = (charId, guildId) => {
    setCharacters((prev) => prev.map((c) => (c.id === charId ? { ...c, guildId } : c)));
    // actualizar link único char->guild
    setLinks((prev) => {
      const without = prev.filter((l) => !(l.from === charId && l.to.startsWith("guild_")));
      return guildId ? [...without, { from: charId, to: guildId }] : without;
    });
  };

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-screen" style={{ backgroundColor: pastelBlueDark }}>
      {/* Panel izquierdo: Crear Personaje */}
      <Card className="shadow-lg rounded-2xl p-4 xl:col-span-1">
        <CardContent>
          <h2 className="text-xl font-bold mb-4 text-white">Crear Personaje</h2>
          <Input
            placeholder="Nombre"
            value={newChar.name}
            onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
            className="mb-2"
          />
          <Textarea
            placeholder="Descripción"
            value={newChar.description}
            onChange={(e) => setNewChar({ ...newChar, description: e.target.value })}
            className="mb-2"
          />
          <Input type="file" accept="image/*" onChange={handleImageUpload} className="mb-4" />

          {/* Cualidades con barras */}
          {Object.keys(newChar.qualities).map((q, i) => (
            <div key={q} className="mb-2">
              <label className="block text-sm font-medium text-white">{q}:</label>
              <Input
                type="number"
                value={newChar.qualities[q]}
                onChange={(e) => handleQualityChange(q, e.target.value)}
                className="mb-1"
              />
              <div className="w-full h-2 rounded bg-gray-300">
                <div
                  className={`${colors[i % colors.length]} h-2 rounded`}
                  style={{ width: `${newChar.qualities[q]}%` }}
                ></div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addExtraQuality} className="mb-4 flex items-center">
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Cualidad
          </Button>

          <div className="mb-3">
            <label className="block text-sm font-medium text-white mb-1">Asignar a Gremio (opcional)</label>
            <select
              className="w-full rounded border p-2"
              value={newChar.guildId}
              onChange={(e) => setNewChar({ ...newChar, guildId: e.target.value })}
            >
              <option value="">— Ninguno —</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <Button onClick={addCharacter}>Crear</Button>
        </CardContent>
      </Card>

      {/* Panel medio: Lista de personajes */}
      <div className="grid gap-4 xl:col-span-1">
        {characters.map((char) => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="shadow-md rounded-2xl p-4 border bg-white"
          >
            {char.image && (
              <img src={char.image} alt="sprite" className="w-24 h-24 rounded-full mb-2" />
            )}
            <h3 className="text-lg font-semibold">{char.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{char.description}</p>
            <ul className="text-sm mb-2">
              {Object.entries(char.qualities).map(([q, v], i) => (
                <li key={q} className="mb-1">
                  <strong>{q}:</strong> {v}
                  <div className="w-full h-2 rounded bg-gray-300">
                    <div
                      className={`${colors[i % colors.length]} h-2 rounded`}
                      style={{ width: `${v}%` }}
                    ></div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm">Gremio:</label>
              <select
                className="rounded border p-1 text-sm"
                value={char.guildId || ""}
                onChange={(e) => assignCharToGuild(char.id, e.target.value)}
              >
                <option value="">— Ninguno —</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <Button variant="destructive" onClick={() => removeCharacter(char.id)} className="flex items-center">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Panel derecho: Gremios + Canvas de Red */}
      <div className="xl:col-span-1 flex flex-col gap-4">
        <Card className="shadow-lg rounded-2xl p-4">
          <CardContent>
            <h2 className="text-lg font-semibold mb-3">Gremios</h2>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Nombre del gremio"
                value={newGuild.name}
                onChange={(e) => setNewGuild({ ...newGuild, name: e.target.value })}
              />
              <Input
                type="color"
                value={newGuild.color}
                onChange={(e) => setNewGuild({ ...newGuild, color: e.target.value })}
                className="w-16 p-1"
                title="Color"
              />
              <Button onClick={addGuild}>Agregar</Button>
            </div>

            <div className="grid gap-2">
              {guilds.map((g) => (
                <div key={g.id} className="flex items-center justify-between border rounded p-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: g.color }} />
                    <span>{g.name}</span>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeGuild(g.id)}>Eliminar</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Canvas grande con zoom/pan y drag de nodos */}
        <CanvasNetwork
          characters={characters}
          guilds={guilds}
          links={links}
          nodePositions={nodePositions}
          setNodePositions={setNodePositions}
        />
      </div>
    </div>
  );
}
