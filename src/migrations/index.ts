import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20260930_070407_footer_content_json from './20260930_070407_footer_content_json';
import * as migration_20260930_071837_testimonial_collection from './20260930_071837_testimonial_collection';
import * as migration_20260930_193000_typed_content_model from './20260930_193000_typed_content_model';
import * as migration_20260930_201500_section_mapping_fields from './20260930_201500_section_mapping_fields';
import * as migration_20261002_001700_preserve_legacy_tags from './20261002_001700_preserve_legacy_tags';
import * as migration_20261009_120000_wireframe_content_model from './20261009_120000_wireframe_content_model';
import * as migration_20261010_120000_detail_collections from './20261010_120000_detail_collections';
import * as migration_20261012_120000_section_card_cleanup from './20261012_120000_section_card_cleanup';
import * as migration_20261013_120000_project_content_and_cleanup from './20261013_120000_project_content_and_cleanup';
import * as migration_20261014_120000_restructure_collections from './20261014_120000_restructure_collections';
import * as migration_20261015_120000_how_we_work_steps from './20261015_120000_how_we_work_steps';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20260930_070407_footer_content_json.up,
    down: migration_20260930_070407_footer_content_json.down,
    name: '20260930_070407_footer_content_json',
  },
  {
    up: migration_20260930_071837_testimonial_collection.up,
    down: migration_20260930_071837_testimonial_collection.down,
    name: '20260930_071837_testimonial_collection'
  },
  {
    up: migration_20260930_193000_typed_content_model.up,
    down: migration_20260930_193000_typed_content_model.down,
    name: '20260930_193000_typed_content_model',
  },
  {
    up: migration_20260930_201500_section_mapping_fields.up,
    down: migration_20260930_201500_section_mapping_fields.down,
    name: '20260930_201500_section_mapping_fields',
  },
  {
    up: migration_20261002_001700_preserve_legacy_tags.up,
    down: migration_20261002_001700_preserve_legacy_tags.down,
    name: '20261002_001700_preserve_legacy_tags',
  },
  {
    up: migration_20261009_120000_wireframe_content_model.up,
    down: migration_20261009_120000_wireframe_content_model.down,
    name: '20261009_120000_wireframe_content_model',
  },
  {
    up: migration_20261010_120000_detail_collections.up,
    down: migration_20261010_120000_detail_collections.down,
    name: '20261010_120000_detail_collections',
  },
  {
    up: migration_20261012_120000_section_card_cleanup.up,
    down: migration_20261012_120000_section_card_cleanup.down,
    name: '20261012_120000_section_card_cleanup',
  },
  {
    up: migration_20261013_120000_project_content_and_cleanup.up,
    down: migration_20261013_120000_project_content_and_cleanup.down,
    name: '20261013_120000_project_content_and_cleanup',
  },
  {
    up: migration_20261014_120000_restructure_collections.up,
    down: migration_20261014_120000_restructure_collections.down,
    name: '20261014_120000_restructure_collections',
  },
  {
    up: migration_20261015_120000_how_we_work_steps.up,
    down: migration_20261015_120000_how_we_work_steps.down,
    name: '20261015_120000_how_we_work_steps',
  },
];
