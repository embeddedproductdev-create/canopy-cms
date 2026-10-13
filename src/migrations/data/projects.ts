export interface ProjectBlock {
  kind: 'h2' | 'h3' | 'p'
  text: string
}

export interface ProjectContent {
  slug: string
  subheading: string
  category: string
  featured: boolean
  projectStage: string
  tags: string
  overview: { label: string; text: string }[]
  atAGlance: { label: string; value: string }[]
  specGroups: { heading: string; rows: { label: string; value: string; builtIn: boolean }[] }[]
  body: ProjectBlock[]
  highlights: { heading: string; text: string }
  gap: { heading: string; cards: { title: string; text: string }[] }
}

export const projectContent: ProjectContent[] = [
  {
    "slug": "smart-bms",
    "subheading": "A robust 4S Li-ion battery management system engineered with field-upgradable OTA capabilities, real-time telemetry, and continuous 20A power delivery.",
    "category": "Embedded Systems & Power Electronics",
    "featured": true,
    "projectStage": "shipped",
    "tags": "BMS, Battery Management, Power Electronics, Firmware, FreeRTOS, CAN Bus, OTA, Hardware Validation, ARM Cortex",
    "overview": [
      {
        "label": "The Idea",
        "text": "A battery management system that can be updated in the field without requiring a physical recall."
      },
      {
        "label": "The Gap",
        "text": "No in-house multi-disciplinary team spanning circuit design, bare-metal/RTOS firmware, and rigorous validation."
      },
      {
        "label": "Our Role",
        "text": "We acted as the complete turnkey engineering team, delivering hardware, firmware, and validation under one roof."
      }
    ],
    "atAGlance": [
      {
        "label": "Pack Architecture",
        "value": "4S - Li-ion 4-Cell Pack"
      },
      {
        "label": "Current Delivery",
        "value": "20A Continuous (30A Bursts)"
      },
      {
        "label": "Fuel Gauging",
        "value": "Precision Battery Health Tracking"
      },
      {
        "label": "Firmware Updates",
        "value": "OTA-Ready Dual-Bank Architecture"
      }
    ],
    "specGroups": [
      {
        "heading": "Battery & Power",
        "rows": [
          {
            "label": "Pack Configuration",
            "value": "4S (4-cell series) Li-ion",
            "builtIn": false
          },
          {
            "label": "Continuous Current",
            "value": "20A (30A bursts)",
            "builtIn": false
          },
          {
            "label": "Battery Health",
            "value": "Fuel-gauge tracking",
            "builtIn": true
          }
        ]
      },
      {
        "heading": "Protection Features",
        "rows": [
          {
            "label": "Over-Voltage / Under-Voltage Protection",
            "value": "Built in",
            "builtIn": true
          },
          {
            "label": "Over-Current / Short-Circuit Protection",
            "value": "Built in",
            "builtIn": true
          },
          {
            "label": "Over-Temperature Protection",
            "value": "Built in",
            "builtIn": true
          },
          {
            "label": "Cell Imbalance Protection",
            "value": "Built in",
            "builtIn": true
          }
        ]
      },
      {
        "heading": "Connectivity & Software",
        "rows": [
          {
            "label": "Communication Protocol",
            "value": "CAN bus",
            "builtIn": true
          },
          {
            "label": "Controller",
            "value": "32-bit ARM Cortex-M0-class",
            "builtIn": true
          },
          {
            "label": "RTOS",
            "value": "FreeRTOS",
            "builtIn": true
          },
          {
            "label": "Bootloader & OTA",
            "value": "Dual-bank bootloader architecture, ready for signed OTA with automatic rollback",
            "builtIn": true
          }
        ]
      }
    ],
    "body": [
      {
        "kind": "h2",
        "text": "Architectural Highlights & Features"
      },
      {
        "kind": "p",
        "text": "Designed for demanding deployment environments, the system features scalable pack sizes, live OLED/display telemetry showing real-time voltage, runtime, and battery percentage, alongside USB-C fast charging and dual auxiliary power outputs. Controlled via a single-button wake, reset, and display interface, it incorporates comprehensive hardware safety mechanisms and dedicated built-in programming ports."
      },
      {
        "kind": "h2",
        "text": "The Engineering Gap We Closed"
      },
      {
        "kind": "h3",
        "text": "Circuit & Pack Architecture"
      },
      {
        "kind": "p",
        "text": "Engineered advanced cell balancing topologies, integrated hardware protection circuitry, and optimized thermal stackups for pack-level layout integrity."
      },
      {
        "kind": "h3",
        "text": "Dual-Bank Bootloader (OTA-Ready)"
      },
      {
        "kind": "p",
        "text": "Implemented a resilient dual-bank bootloader architecture supporting cryptographically signed over-the-air (OTA) updates complete with automated fail-safe rollback execution."
      },
      {
        "kind": "h3",
        "text": "Hardware-in-the-Loop Validation"
      },
      {
        "kind": "p",
        "text": "Subjected the hardware and firmware to rigorous automated failure injection testing and boundary condition stress before live cells ever touched the prototype."
      }
    ],
    "highlights": {
      "heading": "Architectural Highlights & Features",
      "text": "Designed for demanding deployment environments, the system features scalable pack sizes, live OLED/display telemetry showing real-time voltage, runtime, and battery percentage, alongside USB-C fast charging and dual auxiliary power outputs. Controlled via a single-button wake, reset, and display interface, it incorporates comprehensive hardware safety mechanisms and dedicated built-in programming ports."
    },
    "gap": {
      "heading": "The Engineering Gap We Closed",
      "cards": [
        {
          "title": "Circuit & Pack Architecture",
          "text": "Engineered advanced cell balancing topologies, integrated hardware protection circuitry, and optimized thermal stackups for pack-level layout integrity."
        },
        {
          "title": "Dual-Bank Bootloader (OTA-Ready)",
          "text": "Implemented a resilient dual-bank bootloader architecture supporting cryptographically signed over-the-air (OTA) updates complete with automated fail-safe rollback execution."
        },
        {
          "title": "Hardware-in-the-Loop Validation",
          "text": "Subjected the hardware and firmware to rigorous automated failure injection testing and boundary condition stress before live cells ever touched the prototype."
        }
      ]
    }
  },
  {
    "slug": "ble-mesh-rs485-energy-meter",
    "subheading": "Retrofitting legacy industrial energy meters with reliable wireless multi-hop connectivity without altering the meter's internal communication stack.",
    "category": "IoT & Wireless Hardware",
    "featured": true,
    "projectStage": "shipped",
    "tags": "BLE Mesh, RS485, Modbus, IoT, Energy Meter, Retrofit, Wireless, Firmware, Hardware Design",
    "overview": [
      {
        "label": "The Idea",
        "text": "Retrofit legacy energy meters with wireless connectivity without touching the meter's proprietary wired communication stack."
      },
      {
        "label": "The Gap",
        "text": "BLE Mesh and RS485/Modbus stacks rarely coexist cleanly on a single board or within a single firmware team. We engineered both sides."
      },
      {
        "label": "Our Role",
        "text": "We delivered the complete dual-protocol hardware platform and synchronized firmware architecture."
      }
    ],
    "atAGlance": [
      {
        "label": "Wired Interface",
        "value": "RS485 / Modbus Down to the Meter"
      },
      {
        "label": "Wireless Connectivity",
        "value": "Auto Mesh Join & Reconnect"
      },
      {
        "label": "I/O Capacity",
        "value": "8 Configurable I/O Channels"
      },
      {
        "label": "Physical Protection",
        "value": "Surge + Wiring Protection Architecture"
      }
    ],
    "specGroups": [
      {
        "heading": "Physical & Electrical Specification",
        "rows": [
          {
            "label": "Enclosure & Form Factor",
            "value": "Rugged, all-weather retrofit board matching existing meter footprint",
            "builtIn": false
          },
          {
            "label": "Power & State Memory",
            "value": "Non-volatile configuration storage surviving sudden power loss",
            "builtIn": true
          },
          {
            "label": "Diagnostic Indicators",
            "value": "Dedicated Power, Link, and Activity LEDs",
            "builtIn": true
          }
        ]
      },
      {
        "heading": "Communication & Protocol Stack",
        "rows": [
          {
            "label": "Downstream Protocol",
            "value": "RS485 / Modbus RTU",
            "builtIn": true
          },
          {
            "label": "Upstream Protocol",
            "value": "BLE Mesh multi-hop networking",
            "builtIn": true
          },
          {
            "label": "Wiring & Terminals",
            "value": "Heavy-duty industrial screw terminals",
            "builtIn": true
          }
        ]
      }
    ],
    "body": [
      {
        "kind": "h2",
        "text": "System Design & Capabilities"
      },
      {
        "kind": "p",
        "text": "Built for harsh field deployments, this rugged all-weather board features robust surge and reverse-wiring protection, screw-terminal interfaces, non-volatile configuration memory that preserves settings across power cycles, and real-time remote diagnostic reporting."
      },
      {
        "kind": "h2",
        "text": "The Engineering Gap We Closed"
      },
      {
        "kind": "h3",
        "text": "BLE Mesh Networking"
      },
      {
        "kind": "p",
        "text": "Engineered a reliable multi-hop mesh upstream architecture featuring seamless node provisioning and automatic network healing without requiring a gateway hardware replacement."
      },
      {
        "kind": "h3",
        "text": "RS485 / Modbus Bridge"
      },
      {
        "kind": "p",
        "text": "Developed transparent protocol bridging that interfaces directly with the legacy meter's native communication stack with zero modifications required to the meter firmware."
      },
      {
        "kind": "h3",
        "text": "Retrofit-Ready Mechanical Design"
      },
      {
        "kind": "p",
        "text": "Precision-engineered the PCB and mounting geometry to fit directly into the exact physical enclosure footprint already deployed in the field."
      }
    ],
    "highlights": {
      "heading": "System Design & Capabilities",
      "text": "Built for harsh field deployments, this rugged all-weather board features robust surge and reverse-wiring protection, screw-terminal interfaces, non-volatile configuration memory that preserves settings across power cycles, and real-time remote diagnostic reporting."
    },
    "gap": {
      "heading": "The Engineering Gap We Closed",
      "cards": [
        {
          "title": "BLE Mesh Networking",
          "text": "Engineered a reliable multi-hop mesh upstream architecture featuring seamless node provisioning and automatic network healing without requiring a gateway hardware replacement."
        },
        {
          "title": "RS485 / Modbus Bridge",
          "text": "Developed transparent protocol bridging that interfaces directly with the legacy meter's native communication stack with zero modifications required to the meter firmware."
        },
        {
          "title": "Retrofit-Ready Mechanical Design",
          "text": "Precision-engineered the PCB and mounting geometry to fit directly into the exact physical enclosure footprint already deployed in the field."
        }
      ]
    }
  },
  {
    "slug": "dual-channel-charger",
    "subheading": "A high-efficiency dual-pack charging platform where power stage electronics and control firmware are co-designed from day one.",
    "category": "Power Electronics & Firmware",
    "featured": false,
    "projectStage": "shipped",
    "tags": "Power Electronics, Battery Charger, Firmware, Thermal Design, CFD, Li-ion, Hardware Engineering, Smart BMS",
    "overview": [
      {
        "label": "The Idea",
        "text": "A charging platform where the power conversion stage and control firmware are designed in lockstep, eliminating integration friction."
      },
      {
        "label": "The Gap",
        "text": "Most development cycles fracture power electronics and embedded firmware across two separate external vendors. We provide both under one unified team."
      },
      {
        "label": "Our Role",
        "text": "We designed and validated the entire power stage, thermal layout, and charging control firmware concurrently."
      }
    ],
    "atAGlance": [
      {
        "label": "Channel Capacity",
        "value": "100W Per Channel (~200W Total)"
      },
      {
        "label": "Conversion Efficiency",
        "value": "90%+ Peak Efficiency"
      },
      {
        "label": "Ecosystem Integration",
        "value": "Engineered to Pair with Smart BMS"
      },
      {
        "label": "Thermal & Layout",
        "value": "CFD-Optimized Low-Noise Architecture"
      }
    ],
    "specGroups": [
      {
        "heading": "Power & Efficiency Specifications",
        "rows": [
          {
            "label": "Output Architecture",
            "value": "Two independent charging outputs",
            "builtIn": true
          },
          {
            "label": "Power Rating",
            "value": "100W per channel (~200W total)",
            "builtIn": false
          },
          {
            "label": "Efficiency",
            "value": "90%+ conversion efficiency",
            "builtIn": false
          }
        ]
      },
      {
        "heading": "Safety & Software Intelligence",
        "rows": [
          {
            "label": "Battery Interfacing",
            "value": "Automatic telemetry and profile sensing per pack",
            "builtIn": true
          },
          {
            "label": "Protection Suite",
            "value": "Full hardware protection including deeply discharged cell recovery",
            "builtIn": true
          },
          {
            "label": "Firmware Flexibility",
            "value": "Software-updatable charging behaviors and safety thresholds",
            "builtIn": true
          }
        ]
      }
    ],
    "body": [
      {
        "kind": "h2",
        "text": "Platform Features & Capabilities"
      },
      {
        "kind": "p",
        "text": "The charger automatically detects and negotiates charging requirements for each attached battery independently, operating safely across demanding temperature ranges. It features fail-safe default charging profiles, per-output status lighting, comprehensive hardware fault protection (including safe recovery of fully drained batteries), and a compact layout optimized for passive thermal airflow and minimal electrical noise."
      },
      {
        "kind": "h2",
        "text": "The Engineering Gap We Closed"
      },
      {
        "kind": "h3",
        "text": "Power Electronics & Two-Channel Architecture"
      },
      {
        "kind": "p",
        "text": "Engineered independent dual power stages sharing a unified thermal dissipation path and optimized PCB layout budget to eliminate cross-channel interference."
      },
      {
        "kind": "h3",
        "text": "Charge-Control Firmware"
      },
      {
        "kind": "p",
        "text": "Developed closed-loop charge profile logic written specifically against the physical hardware characteristics rather than relying on generic reference schematics."
      },
      {
        "kind": "h3",
        "text": "Thermal & Enclosure Design"
      },
      {
        "kind": "p",
        "text": "Validated thermal dissipation performance using Computational Fluid Dynamics (CFD) simulation alongside DFM-optimized enclosure engineering."
      }
    ],
    "highlights": {
      "heading": "Platform Features & Capabilities",
      "text": "The charger automatically detects and negotiates charging requirements for each attached battery independently, operating safely across demanding temperature ranges. It features fail-safe default charging profiles, per-output status lighting, comprehensive hardware fault protection (including safe recovery of fully drained batteries), and a compact layout optimized for passive thermal airflow and minimal electrical noise."
    },
    "gap": {
      "heading": "The Engineering Gap We Closed",
      "cards": [
        {
          "title": "Power Electronics & Two-Channel Architecture",
          "text": "Engineered independent dual power stages sharing a unified thermal dissipation path and optimized PCB layout budget to eliminate cross-channel interference."
        },
        {
          "title": "Charge-Control Firmware",
          "text": "Developed closed-loop charge profile logic written specifically against the physical hardware characteristics rather than relying on generic reference schematics."
        },
        {
          "title": "Thermal & Enclosure Design",
          "text": "Validated thermal dissipation performance using Computational Fluid Dynamics (CFD) simulation alongside DFM-optimized enclosure engineering."
        }
      ]
    }
  }
]
