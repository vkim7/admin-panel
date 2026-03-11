# Rive Animated Character Guide

Reference for creating AI-assisted animated characters in Rive (e.g., a monkey mascot with emotional states).

## Rive Overview

Rive is an interactive animation engine. The editor outputs `.riv` files that run cross-platform via lightweight runtimes (React, Flutter, iOS, etc.). Animations are built visually with a timeline + state machine, and optionally extended with Luau scripting.

### Key Concepts

- **State Machine** — visual graph of states (idle, happy, sad) with transitions and inputs. No code needed.
- **Luau Scripting** — optional code layer for procedural behavior (physics, particles, randomization). Scripts compile to bytecode embedded in the `.riv` file.
- **AI Coding Agent** — built into the Rive Editor. Chat-based, generates Luau code, answers questions, helps debug. Billed via AI credits ($1 USD = $1 credit). Included on paid plans (Cadet $5/mo, Voyager $16/mo, Enterprise $40/mo per seat).
- **MCP Server** — external bridge (Cursor/Claude Desktop) that lets AI agents programmatically control the Rive editor: create state machines, transitions, view models, shapes. Mac-only as of early 2026.

## Import Formats

| Format | Use Case | Notes |
|--------|----------|-------|
| **SVG** | Vector art, riggable characters | Best for animation. Groups become layers. Use Presentation Attributes (not CSS classes). No embedded images or gradient transforms. |
| **PNG/JPG/WebP** | Flat raster images, backgrounds | Can't be rigged with bones — used as static assets. |
| **PSD** | Layered raster art | Preserves Photoshop layers on import. |

**For animated characters, SVG is the right format** — it gives you separable, riggable vector parts.

## AI-Optimized Character Pipeline

### Step 1: Generate Character Art (SVG)

**Best approach: prompt ChatGPT or Claude to generate SVG directly.**

Each body part should be a separate `<g>` group so Rive imports them as individual layers.

Example prompt:
> Generate an SVG of a cartoon monkey character. Flat colors, no gradients, no shadows. Separate grouped elements with descriptive IDs for: body, head, left_arm, right_arm, left_leg, right_leg, tail, eyes, mouth. Simple rounded shapes suitable for animation. Cute, friendly style.

Tips:
- Keep it flat — gradients and shadows don't convert well
- Name groups clearly — they become layer names in Rive
- Avoid embedded raster images (Rive ignores them in SVG)
- For more stylized art: generate with Midjourney/image AI → vectorize with Vectorizer.ai or Inkscape trace → manually separate parts (slower path)

### Step 2: Import into Rive

- Copy SVG code → paste directly into Rive Editor
- Or drag-drop the `.svg` file onto the editor
- SVG groups automatically become separate layers
- If exporting from Illustrator: set CSS Properties to "Presentation Attributes", disable "Preserve Illustrator Editing Capabilities"

### Step 3: Rig the Character (Manual)

This step requires a human — AI can't automate it yet.

- Set pivot points on each part (e.g., arm pivots at shoulder)
- Create bone hierarchy: body → head, body → left_arm, body → right_arm, body → tail, etc.
- Set up constraints if needed (e.g., eyes follow pointer)
- ~15-30 min for a simple character

### Step 4: Create Animations (Timeline — Manual)

Keyframe each emotional state on the timeline:

| State | Animation Ideas | Loop? |
|-------|----------------|-------|
| **Idle** | Subtle breathing, blinking, gentle tail sway | Yes |
| **Thinking** | Scratch head, look up, slow blink | Yes or one-shot |
| **Happy** | Big smile, bounce, arms up, fast tail wag | Yes or one-shot → idle |
| **Sad** | Droopy posture, frown, slow tail, tear drop | Yes or one-shot |

This is the highest-effort step and requires animation skill.

### Step 5: Wire Up State Machine (AI-Assisted)

**Can be automated with the Rive MCP Server:**
- Create state machine with 4 states
- Add transitions and conditions between states
- Create inputs (number input `emotion` or separate triggers)

The MCP server reportedly reduces a 3.5-hour manual task to ~15 minutes for complex state machines.

Without MCP, this is straightforward to do manually in the visual state machine editor for just 4 states.

### Step 6: Add Scripting (Optional, AI-Assisted)

For a simple 4-state character, **scripting is likely not needed**. The visual state machine handles discrete states well.

Consider Luau scripting (via Rive's AI Coding Agent) for:
- Procedural idle variations (randomized blinks, fidgets)
- Physics-based tail or body movement
- Particle effects (sparkles when happy, rain when sad)
- Pointer-following eyes
- Data-driven state changes

## Integration in App

```typescript
// React example with @rive-app/react-canvas
import { useRive } from '@rive-app/react-canvas';

const Monkey = () => {
  const { rive, RiveComponent } = useRive({
    src: 'monkey.riv',
    stateMachines: 'MonkeyState',
    autoplay: true,
  });

  const setEmotion = (state: number) => {
    // 0=idle, 1=thinking, 2=happy, 3=sad
    rive?.setNumberStateInput('emotion', state);
  };

  return <RiveComponent />;
};
```

## AI Automation Summary

| Step | AI-Automated? | Tool |
|------|--------------|------|
| Character art generation (SVG) | Yes | ChatGPT / Claude |
| Part separation in SVG | Yes (if prompted correctly) | ChatGPT / Claude |
| Import to Rive | Manual (drag & paste) | Rive Editor |
| Bone rigging | No — manual | Rive Editor |
| State machine setup | Yes | Rive MCP Server |
| Transitions & inputs | Yes | Rive MCP Server |
| Keyframe animation | No — manual | Rive Editor timeline |
| Procedural behaviors | Yes | Rive AI Coding Agent (Luau) |

**Two manual bottlenecks:** bone rigging and keyframe animation. Both require human skill. Everything structural around them can be AI-generated.

## Resources

- [Rive: Importing Assets](https://help.rive.app/editor/fundamentals/importing-assets)
- [Rive MCP Server Deep Dive](https://skywork.ai/skypage/en/unlocking-rive-ai-editor/1981622296102629376)
- [RiveMCP — 132 AI Animation Tools](https://rivemcp.stunning.gg/)
- [Rive AI Coding Agent FAQ](https://rive.app/blog/rive-ai-coding-agent-faq)
- [Why Rive Scripting Runs on Luau](https://rive.app/blog/why-scripting-runs-on-luau)
- [Rive Scripting System (DeepWiki)](https://deepwiki.com/rive-app/rive-runtime/8-scripting-system)
- [Scripting Workflow Learnings (LinkedIn)](https://www.linkedin.com/pulse/finding-my-scripting-workflow-rive-mayte-cg-smxye/)
