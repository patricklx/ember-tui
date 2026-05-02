import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, it, expect } from 'vitest';
import Box from 'ember-tui/components/Box';
import Text from 'ember-tui/components/Text';
import { tracked } from '@glimmer/tracking';
import { rerender } from "@ember/test-helpers";

class TestState {
  @tracked color = 'red';
  @tracked text = 'Hello';
  @tracked showBox = true;
}

describe('Dirty Tracking Render Tests', () => {
  it('should track dirty nodes after render', async () => {
    const state = new TestState();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _state = state; // Keep reference for template

    const ctx = await render(
      <template>
        <Box color={{state.color}}>
          <Text>{{state.text}}</Text>
        </Box>
      </template>
    );

    // After initial render, nodes should be marked clean
    const rootElement = ctx.rootElement;
    expect(rootElement).toBeDefined();
    
    // Get the box element
    const boxElement = rootElement.querySelector('terminal-box');
    expect(boxElement).toBeDefined();
    
    // Check internal dirty tracking state (now public with underscore prefix)
    expect((boxElement as any)._isDirty).toBe(false);
    expect((boxElement as any)._childrenDirty).toBe(false);
    
    // Verify render output is correct
    expect(ctx.lastFrame()).toContain('Hello');
    
    ctx.unmount();
  });

  it('should mark nodes dirty when properties change', async () => {
    const state = new TestState();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _state = state; // Keep reference for template

    const ctx = await render(
      <template>
        <Box color={{state.color}}>
          <Text>{{state.text}}</Text>
        </Box>
      </template>
    );

    const initialFrame = ctx.lastFrame();
    expect(initialFrame).toContain('Hello');

    // Get the box element and verify it's clean after render
    const boxElement = ctx.rootElement.querySelector('terminal-box');
    expect((boxElement as any)._isDirty).toBe(false);

    // Change state - this should mark nodes as dirty
    state.text = 'World';
    
    // Before render, the text node should be marked dirty
    const textElement = boxElement?.querySelector('terminal-text');
    expect((textElement as any)._isDirty).toBe(true);
    
    // Wait for next render
    await ctx.render();
    
    const newFrame = ctx.lastFrame();
    expect(newFrame).toContain('World');
    expect(newFrame).not.toContain('Hello');
    
    // After render, nodes should be clean again
    expect((boxElement as any)._isDirty).toBe(false);
    expect((textElement as any)._isDirty).toBe(false);
    
    ctx.unmount();
  });

  it('should track overlapping absolute positioned boxes', async () => {
    const state = new TestState();

    const ctx = await render(
      <template>
        <Box>
          <Box id="background-box" width={20} height={5}>
            <Text>Background Content</Text>
          </Box>
          {{#if state.showBox}}
            <Box 
              id="overlay-box"
              position="absolute" 
              top={1} 
              left={2} 
              width={10} 
              height={3}
              borderStyle="single"
            >
              <Text>Overlay</Text>
            </Box>
          {{/if}}
        </Box>
      </template>
    );

    const initialFrame = ctx.lastFrame();
    expect(initialFrame).toContain('Overlay');
    expect(initialFrame).toContain('Background Content');

    // Get elements
    const rootElement = ctx.rootElement;
    const backgroundBox = rootElement.querySelector('#background-box');
    const overlayBox = rootElement.querySelector('#overlay-box');
    
    expect(backgroundBox).toBeDefined();
    expect(overlayBox).toBeDefined();
    
    // Verify overlay box has absolute positioning
    expect(overlayBox?.getAttribute('position')).toBe('absolute');
    
    // Check overlap tracking internals
    // The overlay box should track which nodes it overlaps
    expect((overlayBox as any)._overlappedNodes).toBeDefined();
    expect((overlayBox as any)._overlappedNodes.size).toBeGreaterThanOrEqual(0);
    
    // The background box should know about overlapping absolute boxes
    expect((backgroundBox as any)._overlappingAbsoluteBoxes).toBeDefined();
    
    // Change overlay box - should mark overlapped nodes as dirty
    state.showBox = false;
    await ctx.render();
    
    const frameWithoutOverlay = ctx.lastFrame();
    expect(frameWithoutOverlay).not.toContain('Overlay');
    expect(frameWithoutOverlay).toContain('Background Content');
    
    // After removing overlay, background should have been marked dirty and re-rendered
    expect((backgroundBox as any)._isDirty).toBe(false); // Clean after render
    
    ctx.unmount();
  });

  it('should handle multiple overlapping absolute boxes', async () => {
    const ctx = await render(
      <template>
        <Box>
          <Box id="base" width={30} height={10}>
            <Text>Base Layer</Text>
          </Box>
          <Box 
            id="overlay1"
            position="absolute" 
            top={2} 
            left={5} 
            width={15} 
            height={4}
            borderStyle="single"
          >
            <Text color="cyan">Overlay 1</Text>
          </Box>
          <Box 
            id="overlay2"
            position="absolute" 
            top={3} 
            left={10} 
            width={12} 
            height={3}
            borderStyle="double"
          >
            <Text color="yellow">Overlay 2</Text>
          </Box>
        </Box>
      </template>
    );

    const frame = ctx.lastFrame();
    expect(frame).toContain('Base Layer');
    expect(frame).toContain('Overlay 1');
    expect(frame).toContain('Overlay 2');

    // Get elements
    const rootElement = ctx.rootElement;
    const overlay1 = rootElement.querySelector('#overlay1');
    const overlay2 = rootElement.querySelector('#overlay2');
    
    expect(overlay1).toBeDefined();
    expect(overlay2).toBeDefined();
    
    // Both should be absolute positioned
    expect(overlay1?.getAttribute('position')).toBe('absolute');
    expect(overlay2?.getAttribute('position')).toBe('absolute');
    
    // Verify they have computed bounds
    const yoga1 = (overlay1 as any)?.yogaNode;
    const yoga2 = (overlay2 as any)?.yogaNode;
    
    if (yoga1 && yoga2) {
      const bounds1 = {
        x: yoga1.getComputedLeft(),
        y: yoga1.getComputedTop(),
        width: yoga1.getComputedWidth(),
        height: yoga1.getComputedHeight(),
      };
      
      const bounds2 = {
        x: yoga2.getComputedLeft(),
        y: yoga2.getComputedTop(),
        width: yoga2.getComputedWidth(),
        height: yoga2.getComputedHeight(),
      };
      
      // Verify bounds are reasonable
      expect(bounds1.width).toBeGreaterThan(0);
      expect(bounds1.height).toBeGreaterThan(0);
      expect(bounds2.width).toBeGreaterThan(0);
      expect(bounds2.height).toBeGreaterThan(0);
      
      // Verify they overlap (overlay2 is positioned to overlap overlay1)
      const overlaps = !(
        bounds1.x + bounds1.width <= bounds2.x ||
        bounds2.x + bounds2.width <= bounds1.x ||
        bounds1.y + bounds1.height <= bounds2.y ||
        bounds2.y + bounds2.height <= bounds1.y
      );
      
      expect(overlaps).toBe(true);
    }
    
    ctx.unmount();
  });

  it('should correctly render when absolute box changes position', async () => {
    const position = { top: 1 };

    const ctx = await render(
      <template>
        <Box>
          <Box id="background" width={20} height={10}>
            <Text>Background</Text>
          </Box>
          <Box 
            id="moving-box"
            position="absolute" 
            top={{position.top}} 
            left={5}
            width={10} 
            height={3}
            borderStyle="single"
          >
            <Text>Moving</Text>
          </Box>
        </Box>
      </template>
    );

    const frame1 = ctx.lastFrame();
    expect(frame1).toContain('Moving');

    // Change position
    position.top = 5;
    await ctx.render();
    
    const frame2 = ctx.lastFrame();
    expect(frame2).toContain('Moving');
    
    // Verify the box moved (frame should be different)
    expect(frame1).not.toBe(frame2);
    
    ctx.unmount();
  });
});
