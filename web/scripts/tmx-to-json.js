#!/usr/bin/env node
/**
 * tmx-to-json.js
 * Converts a Tiled TMX (XML) map file to Tiled JSON format suitable for Phaser 3.
 * No external dependencies — uses Node.js built-in regex parsing on well-structured TMX XML.
 *
 * Usage: node scripts/tmx-to-json.js <input.tmx> <output.json>
 */

const fs = require('fs');
const path = require('path');

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node tmx-to-json.js <input.tmx> <output.json>');
  process.exit(1);
}

const xml = fs.readFileSync(inputPath, 'utf8');

// --- helpers ---

function attr(str, name) {
  const m = str.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function attrInt(str, name, def = 0) {
  const v = attr(str, name);
  return v !== null ? parseInt(v, 10) : def;
}

function parseProperties(block) {
  const props = [];
  const re = /<property name="([^"]*)" value="([^"]*)"/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    props.push({ name: m[1], type: 'string', value: m[2] });
  }
  return props;
}

// --- parse map header ---
const mapHeaderMatch = xml.match(/<map([^>]*)>/);
if (!mapHeaderMatch) { console.error('No <map> element found'); process.exit(1); }
const mapHeader = mapHeaderMatch[1];

const mapWidth    = attrInt(mapHeader, 'width');
const mapHeight   = attrInt(mapHeader, 'height');
const tileWidth   = attrInt(mapHeader, 'tilewidth', 32);
const tileHeight  = attrInt(mapHeader, 'tileheight', 32);
const mapVersion  = attr(mapHeader, 'version') || '1.0';
const orientation = attr(mapHeader, 'orientation') || 'orthogonal';

// --- parse map-level properties ---
const mapPropsBlockMatch = xml.match(/<map[^>]*>\s*<properties>([\s\S]*?)<\/properties>/);
const mapProperties = mapPropsBlockMatch ? parseProperties(mapPropsBlockMatch[1]) : [];

// --- parse tilesets ---
const tilesets = [];
const tilesetRe = /<tileset([^>]*)>([\s\S]*?)<\/tileset>|<tileset([^\/]*?)\/>/g;
let tsMatch;
while ((tsMatch = tilesetRe.exec(xml)) !== null) {
  const header = tsMatch[1] || tsMatch[3] || '';
  const body   = tsMatch[2] || '';

  const firstgid = attrInt(header, 'firstgid', 1);
  const name     = attr(header, 'name') || '';
  const tw       = attrInt(header, 'tilewidth', tileWidth);
  const th       = attrInt(header, 'tileheight', tileHeight);

  const imageMatch = body.match(/<image([^>]*)>/);
  let imageSource = '', imageWidth = 0, imageHeight = 0, tilecount = 0;
  if (imageMatch) {
    imageSource = attr(imageMatch[1], 'source') || '';
    imageWidth  = attrInt(imageMatch[1], 'width');
    imageHeight = attrInt(imageMatch[1], 'height');
    // source is relative to TMX; convert to just filename for JSON
    imageSource = path.basename(imageSource);
    if (imageWidth && imageHeight && tw && th) {
      tilecount = Math.floor(imageWidth / tw) * Math.floor(imageHeight / th);
    }
  }

  // tile offsets
  const offsetMatch = body.match(/<tileoffset([^>]*)>/);
  const offsetX = offsetMatch ? attrInt(offsetMatch[1], 'x') : 0;
  const offsetY = offsetMatch ? attrInt(offsetMatch[1], 'y') : 0;

  const ts = {
    firstgid,
    image: imageSource,
    imageheight: imageHeight,
    imagewidth: imageWidth,
    margin: 0,
    name,
    spacing: 0,
    tilecount,
    tileheight: th,
    tilewidth: tw,
  };
  if (offsetX !== 0 || offsetY !== 0) {
    ts.tileoffset = { x: offsetX, y: offsetY };
  }
  tilesets.push(ts);
}

// --- parse layers ---
const layers = [];
let nextObjectId = 1;
let layerId = 1;

// tile layers
const tileLayerRe = /<layer([^>]*)>([\s\S]*?)<\/layer>/g;
let tlMatch;
while ((tlMatch = tileLayerRe.exec(xml)) !== null) {
  const header = tlMatch[1];
  const body   = tlMatch[2];

  const lname   = attr(header, 'name') || '';
  const lwidth  = attrInt(header, 'width', mapWidth);
  const lheight = attrInt(header, 'height', mapHeight);
  const visible = attr(header, 'visible');

  // extract tile gids
  const tileGids = [];
  const tileRe2 = /<tile gid="(\d+)"\/>/g;
  let tileM;
  while ((tileM = tileRe2.exec(body)) !== null) {
    tileGids.push(parseInt(tileM[1], 10));
  }

  // also handle <tile/> (gid=0)
  const tileAllRe = /<tile(?:\s+gid="(\d+)")?\/>/g;
  if (tileGids.length === 0) {
    let tileAM;
    while ((tileAM = tileAllRe.exec(body)) !== null) {
      tileGids.push(tileAM[1] ? parseInt(tileAM[1], 10) : 0);
    }
  }

  // parse layer properties
  const propsMatch = body.match(/<properties>([\s\S]*?)<\/properties>/);
  const layerProps = propsMatch ? parseProperties(propsMatch[1]) : [];

  layers.push({
    data: tileGids,
    height: lheight,
    id: layerId++,
    name: lname,
    opacity: 1,
    properties: layerProps.length ? layerProps : undefined,
    type: 'tilelayer',
    visible: visible !== '0',
    width: lwidth,
    x: 0,
    y: 0,
  });
}

// object layers — match both self-closing (<objectgroup ... />) and paired tags
// [^\/\>] ensures we don't greedily consume the / in self-closing tags
const objLayerRe = /<objectgroup((?:[^>\/]|\/(?!>))*)>([\s\S]*?)<\/objectgroup>|<objectgroup((?:[^>\/]|\/(?!>))*)\s*\/>/g;
let olMatch;
while ((olMatch = objLayerRe.exec(xml)) !== null) {
  const header = olMatch[1] || olMatch[3] || '';
  const body   = olMatch[2] || '';

  const lname = attr(header, 'name') || '';

  const objects = [];
  // parse individual objects
  const objRe = /<object([^>]*)>([\s\S]*?)<\/object>|<object([^\/]*?)\/>/g;
  let objM;
  while ((objM = objRe.exec(body)) !== null) {
    const objHeader = objM[1] || objM[3] || '';
    const objBody   = objM[2] || '';

    const oname   = attr(objHeader, 'name') || '';
    const otype   = attr(objHeader, 'type') || '';
    const ogid    = attr(objHeader, 'gid');
    const ox      = parseFloat(attr(objHeader, 'x') || '0');
    const oy      = parseFloat(attr(objHeader, 'y') || '0');
    const ow      = parseFloat(attr(objHeader, 'width') || (ogid ? tileWidth.toString() : '0'));
    const oh      = parseFloat(attr(objHeader, 'height') || (ogid ? tileHeight.toString() : '0'));

    const propsMatch = objBody.match(/<properties>([\s\S]*?)<\/properties>/);
    const objProps = propsMatch ? parseProperties(propsMatch[1]) : [];

    const obj = {
      id: nextObjectId++,
      name: oname,
      type: otype,
      visible: true,
      x: ox,
      y: oy,
      width: ow,
      height: oh,
      rotation: 0,
      properties: objProps.length ? objProps : undefined,
    };
    if (ogid) obj.gid = parseInt(ogid, 10);

    objects.push(obj);
  }

  layers.push({
    draworder: 'topdown',
    id: layerId++,
    name: lname,
    objects,
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  });
}

// --- assemble output ---
const output = {
  height: mapHeight,
  infinite: false,
  layers,
  nextlayerid: layerId,
  nextobjectid: nextObjectId,
  orientation,
  properties: mapProperties.length ? mapProperties : undefined,
  renderorder: 'right-down',
  tiledversion: mapVersion,
  tileheight: tileHeight,
  tilesets,
  tilewidth: tileWidth,
  type: 'map',
  version: '1.2',
  width: mapWidth,
};

// clean undefined fields
const clean = (obj) => JSON.parse(JSON.stringify(obj));

fs.writeFileSync(outputPath, JSON.stringify(clean(output), null, 2));
console.log(`Converted ${inputPath} → ${outputPath}`);
console.log(`  Map: ${mapWidth}×${mapHeight} tiles, ${tileWidth}×${tileHeight}px each`);
console.log(`  Tilesets: ${tilesets.map(t => t.name).join(', ')}`);
console.log(`  Layers: ${layers.map(l => l.name).join(', ')}`);
