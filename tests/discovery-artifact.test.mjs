import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/Users/ovs/Work/summer-rising';
const artifactPath = path.join(repoRoot, 'artifacts/discovery/public-source-endpoints.json');

test('discovery artifact exists and has the expected top-level sections', () => {
  assert.equal(fs.existsSync(artifactPath), true);

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  assert.equal(typeof artifact.captured_at, 'string');
  assert.ok(Array.isArray(artifact.primary_sources));
  assert.ok(Array.isArray(artifact.verification_sources));
  assert.ok(Array.isArray(artifact.field_availability_matrix));
  assert.equal(typeof artifact.browser_fallback, 'object');

  assert.ok(artifact.primary_sources.length > 0);
  assert.ok(artifact.verification_sources.length > 0);
  assert.ok(artifact.field_availability_matrix.length > 0);
});

test('discovery sources are public and reference real snapshot files', () => {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const allSources = [...artifact.primary_sources, ...artifact.verification_sources];

  for (const source of allSources) {
    assert.equal(source.auth, 'public');
    assert.equal(typeof source.name, 'string');
    assert.equal(typeof source.url, 'string');
    assert.equal(typeof source.request_shape, 'string');
    assert.equal(typeof source.response_shape_summary, 'string');
    assert.ok(Array.isArray(source.field_coverage));
    assert.ok(source.field_coverage.length > 0);

    const snapshotPath = path.join(repoRoot, source.snapshot_path);
    assert.equal(fs.existsSync(snapshotPath), true, `${source.name} snapshot missing`);
  }
});

test('field availability matrix covers the requested lead fields', () => {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const fields = new Set(artifact.field_availability_matrix.map((row) => row.field));

  for (const field of [
    'summer_rising_site',
    'provider_name',
    'site_contact_name',
    'site_contact_email',
    'site_contact_phone_number',
    'grade_range',
    'district',
    'borough',
    'site_address',
    'affiliated_school_name',
  ]) {
    assert.equal(fields.has(field), true, `missing matrix row for ${field}`);
  }

  for (const row of artifact.field_availability_matrix) {
    assert.ok([
      'Primary Source',
      'Verification Source',
      'External Enrichment',
      'Missing',
    ].includes(row.classification));
  }
});
