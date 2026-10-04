import assert from 'node:assert/strict';
import {bindToolInput} from '../src/game/tool-input.js';
const canvas=new EventTarget(),button=new EventTarget(),win=new EventTarget(),doc=new EventTarget();button.setPointerCapture=()=>{};
let usable=true,captured=false,shots=0,held=false,releases=0,cancels=0;
const input=bindToolInput({canvas,button,win,doc,allowed:()=>usable,locked:()=>captured,toys:{fire(){shots++;},hold(v){held=v;if(!v)releases++;},cancelHold(){held=false;cancels++;}}});
function event(target,name,fields={}){const e=new Event(name,{cancelable:true});for(const [k,v] of Object.entries(fields))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);}
const mouse={pointerType:'mouse',pointerId:1,button:0,clientX:100,clientY:100};
event(canvas,'pointerdown',mouse);event(win,'pointerup',mouse);assert.equal(shots,1,'Free-look click fires');
event(canvas,'pointerdown',mouse);event(win,'pointermove',{...mouse,clientX:120});event(win,'pointerup',{...mouse,clientX:120});assert.equal(shots,1,'Dragging looks without accidentally firing');
event(canvas,'pointerdown',{...mouse,button:2});assert.equal(held,true,'Right mouse holds the trigger');event(win,'pointerup',{...mouse,button:2});assert.equal(held,false);assert.equal(releases,1);
captured=true;event(canvas,'pointerdown',mouse);assert.equal(held,true,'Captured left mouse holds/charges');event(win,'pointerup',mouse);assert.equal(releases,2);captured=false;
event(canvas,'pointerdown',{...mouse,pointerType:'touch'});event(win,'pointerup',{...mouse,pointerType:'touch'});assert.equal(shots,1,'Touch camera gestures never fire');
event(button,'pointerdown',{...mouse,pointerType:'touch'});assert.equal(held,true,'Touch trigger holds');event(win,'pointerup',{...mouse,pointerType:'touch',pointerId:2});assert.equal(held,true,'Releasing the movement finger does not release the trigger');event(win,'pointerup',{...mouse,pointerType:'touch'});assert.equal(releases,3);
event(win,'keydown',{code:'KeyP',repeat:false});assert.equal(held,true,'P holds the trigger');event(win,'keyup',{code:'KeyP'});assert.equal(releases,4);
event(win,'keydown',{code:'KeyP',repeat:false});event(win,'blur');assert.equal(held,false);event(win,'keyup',{code:'KeyP'});assert.equal(releases,4,'Blur cancels a draw without firing');
usable=false;event(canvas,'pointerdown',mouse);event(win,'pointerup',mouse);event(button,'pointerdown',mouse);assert.equal(shots,1,'Menus, activities and flight block firing');
usable=true;event(win,'keydown',{code:'KeyP',repeat:false});usable=false;event(win,'keyup',{code:'KeyP'});assert.equal(releases,4,'Entering a blocked state cancels rather than releasing a shot');assert.ok(cancels);input.cancel();
console.log('PASS: click versus drag, right/captured hold, touch trigger, P, blur cancellation and activity/menu/flight guards.');
