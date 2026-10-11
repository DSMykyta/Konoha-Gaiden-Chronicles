# Liquid-glass timeline nodes — design and implementation record

Implemented: 2026-10-11.

## User-facing goal

Every **moment, scene, episode, and arc** is a circular droplet of the **same material**.
The hierarchy is communicated by diameter, **not** by a distinct shape or opaque grey color.
Lines passing through each drop should be seen as though through water.
Related droplets appear to pull together with a liquid neck when their *screen-space centers*
approach; they pull apart again during zoom out/in.

## Implementation and reasoning

- `SITE/public/liquid-nodes.js` centralizes screen-space radii, local optical refraction,
  fluid pairing, smooth cubic neck contours, and a specular rim path.
- Radii: moment 7px (11px when numbered in the phone reader), scene 11px,
  episode 15px, arc 20px, multi-arc cluster 24px.
- `SITE/public/app.js` paints translucent blue-white radial glass depth and a brighter rim
  around **circles** for every level; there are no elliptical arc markers.
- Actual character curves are locally re-sampled inside a lens to create a convex-lens
  bend without moving the original SVG strands or changing narrative dates/coordinates.
  A small `feDisplacementMap` ripple is applied for modest route counts; the local
  geometric lens still provides refraction for denser views and browsers without it.
  The original lines remain intact and only the copied *image inside each lens* bends.
- Water-necks are drawn from paired circles as a closed cubic contour; contact increases
  smoothly as the actual centers approach and vanishes as they separate. Only nodes
  in the **same narrative group** or an explicit fine-to-coarse zoom transition can merge.
  Unrelated simultaneous characters / arcs remain independent.
- Hit targets, semantic IDs, hover, keyboard focus, SVG accessibility roles,
  pinned nodes and the zoom/pan camera remain unchanged.
- Decoration is pointer-inert and `aria-hidden`, so it cannot steal taps from nodes.
- SVG filter cost is limited: no whole-backdrop filtering and a bounded number of
  locally refracted fragments. SVG geometry is compatible with buffered panning.
- Reduced transparency disables the refraction layer and uses a solid high-contrast
  base; reduced motion suppresses decorative rim wake.

## Why not CSS backdrop-filter on the entire timeline?

Browser implementations of SVG URL displacement as a backdrop filter are not fully
interoperable. Applying distortion to local duplicated **SVG line geometry** avoids
dependence on browser access to composited backdrop pixels.
See: https://github.com/w3c/svgwg/issues/1142

## Verification

- Source scripts parse successfully as JavaScript.
- Pure numeric checks for radii, same-group fusion and unchanged source coordinates
  were performed during implementation.
- Added automated tests: `SITE/tests/liquid-nodes.test.mjs`.
- Updated `SITE/tests/interface.cjs` so arcs must have circular, rather than
  elliptical, marks.
- **Full npm and real-browser test runs have not been executed in this session**:
  the GitHub-connected environment does not expose the project's full filesystem
  locally. Run `cd SITE && npm test && npm run test:browser` in a checkout
  and inspect several zoom levels on Android/desktop to confirm optics/performance.
