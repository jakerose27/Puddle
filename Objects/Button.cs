using System;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Content;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using Microsoft.Xna.Framework.Storage;
using Microsoft.Xna.Framework.GamerServices;
using TiledSharp;

namespace Puddle
{
    class Button : Sprite
    {
        public bool activating;
        public bool activated;
        public bool holdButton;

        // TODO: add in function passing for individual button actions
        public Button(TmxObjectGroup.TmxObject obj) :
            base(obj.X, obj.Y, 32, 32)
        {
            imageFile = "button.png";
            holdButton = obj.Properties.ContainsKey("hold") && Boolean.Parse(obj.Properties["hold"]);
            if (holdButton)
            {
                holdButton = true;
                spriteColor = Color.Black;
            }
            name = obj.Name;
            collisionWidth = 24;
            collisionHeight = 30;

            if (obj.Properties["direction"].Equals("left"))
            {
                faceLeft = true;
                spriteX -= 9;
            }
            else if(obj.Properties["direction"].Equals("right"))
            {
                faceLeft = false;
                spriteX += 9;
            }
            else if (obj.Properties["direction"].Equals("up"))
            {
                rotationAngle = MathHelper.PiOver2;
                spriteY += 9;
                collisionHeight = 24;
                collisionWidth = 30;
            }
            else
            {
                rotationAngle = MathHelper.PiOver2 * 3;
                spriteY -= 9;
                collisionHeight = 24;
                collisionWidth = 30;
            }

        }

        public override void Update(Physics physics)
        {
            CheckCollisions(physics);
            Animate(physics);
        }

        public void Animate(Physics physics)
        {
            if (CheckCollisions(physics))
            {
                if (frameIndex < (32 * 7))
                    frameIndex += 32;
                else
                    activated = true;
            }
            else
            {
                if (holdButton && frameIndex > 0)
                {
                    frameIndex -= 32;
                }
                else
                    activated = false;
            }
        }

        public bool CheckCollisions(Physics physics)
        {
            if (Intersects(physics.player))
            {
                Action(physics);
                return true;
            }
            foreach (Sprite item in physics.items)
            {
                if (item is Block && Intersects(item) && ((Block)(item)).blockType == "push")
                {
                    Action(physics);
                    return true;
                }
            }
            return false;
        }

        public void Action(Physics physics)
        {
            if (activated)
                return;


            if (this.name == "Button 1")
            {
				foreach (Sprite s in physics.items)
                {
                    if (s.name == "Block 3")
                    {
						((Block)s).changeType("push");
                    }
                }
            }
            else if (this.name == "Button 2")
            {
				foreach (Sprite s in physics.items)
                {
                    if (s.name == "Block 2")
                    {
						((Block)s).changeType("push");
                    }
                }
            }
            else if (this.name == "Button 3")
            {
				foreach (Sprite s in physics.items)
                {
                    if (s.name == "Block 4")
                    {
						((Block)s).changeType("push");                        
                    }
                }
            }

        }
    }
}
