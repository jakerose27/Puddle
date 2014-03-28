#region Using Statements
using System;
using System.Diagnostics;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Content;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using Microsoft.Xna.Framework.Storage;
using Microsoft.Xna.Framework.GamerServices;
using TiledSharp;
using Squared.Tiled;
using ScrollingBackgroundSpace;
#endregion

namespace Puddle
{
    public class Game1 : Game
    {
        GraphicsDeviceManager graphics;
        SpriteBatch spriteBatch;
        Physics physics;
        Player player1;
        Controls controls;
        TmxMap map;
        Map map2;
        Vector2 viewportPosition;
        ScrollingBackground myBackground;
        Layer layer;
        float cameraPosition;

        Texture2D background;

        public Game1()
            : base()
        {
            graphics  = new GraphicsDeviceManager(this);
            Content.RootDirectory = "Content";

           // graphics.PreferredBackBufferWidth = 1280;
            graphics.PreferredBackBufferWidth = 22 * 32;
            graphics.PreferredBackBufferHeight = 15 * 32;
            IsFixedTimeStep = true;
        }

        protected override void Initialize()
        {
            // Read Level Info From Map
            map = new TmxMap("Content/Demo.tmx");

            //graphics.PreferredBackBufferHeight = map.Height * map.TileHeight;
            background = Content.Load<Texture2D>("background.png");
            layer = new Layer(Content, "background.png", 0.2f);

            // Create built-in objects
            player1 = new Player(50, 250, 32, 32);
            physics = new Physics(player1);
            controls = new Controls();

            foreach (TmxObjectGroup group in map.ObjectGroups)
            {
                foreach (TmxObjectGroup.TmxObject obj in group.Objects)
                {
                    Type t = Type.GetType(obj.Type);
                    object item = Activator.CreateInstance(t, obj);
                    if (item is Block)
                        physics.blocks.Add((Block)item);
                    else
                        physics.items.Add((Sprite)item);
                }
            }

            base.Initialize();            
        }

        protected override void LoadContent()
        {
            spriteBatch = new SpriteBatch(GraphicsDevice);

            // TODO: Load all content in level class
            player1.LoadContent(this.Content);
            map2 = Map.Load("Content/Demo1.tmx", Content);

            myBackground = new ScrollingBackground();
            myBackground.Load(GraphicsDevice, background);

            // Create map objects
            //foreach (Squared.Tiled.ObjectGroup group in map2.ObjectGroups.Values)
            //{
            //    foreach (Squared.Tiled.Object obj in group.Objects.Values)
            //    {
            //        Type t = Type.GetType(obj.Properties["type"]);
            //        object item = Activator.CreateInstance(t, obj);
            //        if (item is Block)
            //            physics.blocks.Add((Block)item);
            //        else
            //            physics.items.Add((Sprite)item);
            //    }
            //}

            foreach (Block b in physics.blocks)
                b.LoadContent(this.Content);
            foreach (Sprite item in physics.items)
                item.LoadContent(this.Content);
        }

        protected override void UnloadContent()
        { }

        protected override void Update(GameTime gameTime)
        {
            controls.Update();

            if (controls.onPress(Keys.Escape, Buttons.Back))
                Exit();

            // TODO: Level.Update() should cover all objects in that level
            player1.Update(controls, physics, this.Content, gameTime);
            physics.Update(this.Content);
            myBackground.Update(player1.y_vel-1);
            //viewportPosition.Y = player1.spriteY - 200;

            foreach (Block b in physics.blocks)
                b.Update(physics);

            foreach (Enemy e in physics.enemies)
                e.Update(physics);

            foreach (Sprite s in physics.items)
            {
                s.Update(physics);
                s.Update(physics, this.Content);
            }
            
            base.Update(gameTime);
        }

        protected override void Draw(GameTime gameTime)
        {
            spriteBatch.Begin();
            
            layer.Draw(spriteBatch, cameraPosition);
            ScrollCamera(spriteBatch.GraphicsDevice.Viewport);
            Matrix cameraTransform = Matrix.CreateTranslation(-cameraPosition, 0.0f, 0.0f);
            //spriteBatch.Begin(SpriteBlendMode.AlphaBlend, SpriteSortMode.Immediate, SaveStateMode.None, cameraTransform);

            

            //spriteBatch.Draw(
            //    background,
            //    new Rectangle(
            //        0, 0, 
            //        graphics.PreferredBackBufferWidth,
            //        graphics.PreferredBackBufferHeight
            //    ),
            //    Color.White
            //);

            myBackground.Draw(spriteBatch);
            //map2.Draw(spriteBatch, new Rectangle(0, 0, GraphicsDevice.Viewport.Width, GraphicsDevice.Viewport.Height), viewportPosition);
            Debug.WriteLine(viewportPosition);

            // TODO: Level.Draw() should cover all this
            foreach (Enemy e in physics.enemies)
                e.Draw(spriteBatch);
            foreach (Shot s in physics.shots)
                s.Draw(spriteBatch);
            foreach (Block b in physics.blocks)
                b.Draw(spriteBatch);
            foreach (Sprite item in physics.items)
                item.Draw(spriteBatch);
            foreach (Fireball f in physics.fireballs)
                f.Draw(spriteBatch);
            player1.Draw(spriteBatch);

            spriteBatch.End();
            base.Draw(gameTime);
        }

        private void ScrollCamera(Viewport viewport)
        {
            const float ViewMargin = 0.35f;

            // Calculate the edges of the screen.
            float marginWidth = viewport.Width * ViewMargin;
            float marginLeft = cameraPosition + marginWidth;
            float marginRight = cameraPosition + viewport.Width - marginWidth;

            // Calculate how far to scroll when the player is near the edges of the screen.
            float cameraMovement = 0.0f;
            if (Player.Position.X < marginLeft)
                cameraMovement = Player.Position.X - marginLeft;
            else if (Player.Position.X > marginRight)
                cameraMovement = Player.Position.X - marginRight;

            // Update the camera position, but prevent scrolling off the ends of the level.
            float maxCameraPosition = Tile.Width * Width - viewport.Width;
            cameraPosition = MathHelper.Clamp(cameraPosition + cameraMovement, 0.0f, maxCameraPosition);
        }

    }
}
