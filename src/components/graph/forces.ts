/**
 * Small d3-force compatible forces (a function of alpha with `initialize(nodes)`), so the
 * graph needs no extra d3 dependency. All are O(n) per tick (collide uses a grid).
 */

export type ForceNode = {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

export type CustomForce<N extends ForceNode> = ((alpha: number) => void) & {
  initialize: (nodes: N[]) => void;
};

/**
 * Pulls x (or y) toward a per-node target. `target` returning null leaves the node alone.
 * Pinned nodes (fx/fy set) are skipped.
 */
export function forceAxis<N extends ForceNode>(
  axis: "x" | "y",
  target: (node: N) => number | null,
  strength: (node: N) => number,
): CustomForce<N> {
  let nodes: N[] = [];
  let targets: (number | null)[] = [];
  let strengths: number[] = [];
  const force = ((alpha: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const t = targets[i];
      if (t == null) continue;
      const n = nodes[i]!;
      if (axis === "x") {
        if (n.fx != null) continue;
        n.vx = (n.vx ?? 0) + (t - (n.x ?? 0)) * strengths[i]! * alpha;
      } else {
        if (n.fy != null) continue;
        n.vy = (n.vy ?? 0) + (t - (n.y ?? 0)) * strengths[i]! * alpha;
      }
    }
  }) as CustomForce<N>;
  force.initialize = (next: N[]) => {
    nodes = next;
    targets = next.map(target);
    strengths = next.map(strength);
  };
  return force;
}

/**
 * Keeps nodes `radius(node)` apart (circle collision), using a uniform grid so it stays
 * linear for thousands of nodes. `strength` 0..1 is how much overlap is resolved per tick.
 */
export function forceCollideGrid<N extends ForceNode>(
  radius: (node: N) => number,
  strength = 0.7,
): CustomForce<N> {
  let nodes: N[] = [];
  let radii: number[] = [];
  let maxR = 1;
  // Collision does not scale with alpha (like d3.forceCollide).
  const force = (() => {
    const cell = maxR * 2;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const key = `${Math.floor((n.x ?? 0) / cell)},${Math.floor((n.y ?? 0) / cell)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(i);
      else grid.set(key, [i]);
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      const ax = (a.x ?? 0) + (a.vx ?? 0);
      const ay = (a.y ?? 0) + (a.vy ?? 0);
      const cx = Math.floor((a.x ?? 0) / cell);
      const cy = Math.floor((a.y ?? 0) / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            const b = nodes[j]!;
            const min = radii[i]! + radii[j]!;
            let x = ax - ((b.x ?? 0) + (b.vx ?? 0));
            let y = ay - ((b.y ?? 0) + (b.vy ?? 0));
            let d2 = x * x + y * y;
            if (d2 >= min * min) continue;
            if (d2 === 0) {
              // Coincident: nudge deterministically by index.
              x = (i - j) * 1e-3;
              y = 1e-3;
              d2 = x * x + y * y;
            }
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * strength * 0.5;
            x *= push;
            y *= push;
            if (a.fx == null) {
              a.vx = (a.vx ?? 0) + x;
              a.vy = (a.vy ?? 0) + y;
            }
            if (b.fx == null) {
              b.vx = (b.vx ?? 0) - x;
              b.vy = (b.vy ?? 0) - y;
            }
          }
        }
      }
    }
  }) as unknown as CustomForce<N>;
  force.initialize = (next: N[]) => {
    nodes = next;
    radii = next.map(radius);
    maxR = Math.max(1, ...radii);
  };
  return force;
}
