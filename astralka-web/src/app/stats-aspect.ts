import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Input, NgZone, OnChanges, SimpleChanges } from "@angular/core";
import { ChartSymbol } from "./chart-symbol";
import { ChartText } from "./chart-text";
import { SYMBOL_CUSP, SYMBOL_PLANET, aspect_color, convert_DD_to_DMS } from "./common";
import _ from "lodash";
import { RestService } from "./services/rest.service";

@Component({
    selector: "[svgg-stat-aspect]",
    standalone: true,
    imports: [CommonModule, ChartSymbol, ChartText],
    template: `
        <svg:g>
            <g *ngIf="selected" transform="translate(150, 18)">
                <!--<rect x="0" y="0" width="40" height="40" stroke="#cccccc" fill="#ffffff"></rect>-->
                <g svgg-symbol [x]="0" [y]="0" [name]="selected.aspect.parties[0].name" [options]="{scale: 0.7}"></g>
                <g svgg-symbol [x]="13" [y]="0" [name]="selected.name" [options]="options(selected)"></g>
                <g svgg-symbol [x]="26" [y]="0" [name]="selected.aspect.parties[1].name" [options]="{scale: 0.7}"></g>
                <g svgg-text [x]="39" [y]="0" [text]="formatted_selected"></g>
                <g *ngFor="let line of formatted_response; let i = index;" svgg-text 
                    [x]="-5.5" [y]="22 + i * (18)" 
                    [text]="line"
                    [options]="{fill: '#336699'}"
                    ></g>
                
            </g>
            <g *ngIf="has_response" transform="translate(210, 85)">
                <g *ngFor="let line of formatted_response2; let i = index;" svgg-text 
                    [x]="-5.5" [y]="22 + i * (18)" 
                    [text]="line"
                    [options]="{fill: '#336699'}"
                    ></g>
                
            </g>
            <g *ngFor="let m of matrix" transform="translate(4, 4)">
                <rect *ngIf="m.type == 1" [attr.x]="m.x - 9" [attr.y]="m.y - 9" width="18" height="18"                     
                    (click)="show_aspect_details(m)"
                    cursor="pointer"   
                    class="rect"   
                    [class.selected]="selected === m"              
                >
                </rect>
                <g pointer-events="none" svgg-symbol [x]="m.x" [y]="m.y" [name]="m.name" [options]="options(m)"></g>                
            </g>
            
        </svg:g>
    `,
    styles: [
        `
            .rect {
                stroke: #cccccc;                
                fill: #ffffff;
                cursor: "pointer";                                
            }
            .rect.selected {
                fill: #fcfbc7;
                stroke: #999999;                
            }
            .rect:hover {
                fill: #e5e7e7;        
            }
        `
    ]
})
export class StatsAspect implements OnChanges {
    @Input() x: number = 0;
    @Input() y: number = 0;    
    @Input() stats: any[] = [];

    private readonly step: number = 18;
    public selected: any = null;
    private pool: any[] = [];
    private loaded: boolean = false;

    constructor(private rest: RestService) {
        // this.http.get("config.json").subscribe((data:any) => {
        //     this.serverUrl = data.server;
        //   });

        this.rest.explain$.subscribe((text: string) => {            
            this._response2 = text;
            //this.cdr.detectChanges();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes["stats"]) {
            this.loaded = false;
            
            if (!changes["stats"].currentValue || changes["stats"].currentValue.length < 1 ) {
                this.selected = null;
                this._response = "";
            }
        }
    }

    public get matrix(): any {
        
        if (!this.stats || this.stats.length < 1) {
            return [];
        }
        if (this.loaded) {
            return this.pool;
        }
        this.pool.push({
            x: this.x,
            y: this.y,
            name: SYMBOL_PLANET.Sun,
            type: 0
        });
        const planets = _.values(SYMBOL_PLANET);
        planets.push(SYMBOL_CUSP.Cusp1, SYMBOL_CUSP.Cusp10);        
        for(let i = 1; i < planets.length; i++) {
            let j = 0;
            for(j; j < i; j++) {
                const found: any = _.find(this.stats, x => {
                    const parties = x.parties.map(z => z.name).sort();
                    const matches = [planets[i], planets[j]].sort();
                    return _.isEqual(parties, matches);
                });
                //if (found) {
                    this.pool.push({
                        x: this.x + j * this.step,
                        y: this.y + i * this.step,
                        name: found ? found.aspect.name : '',
                        aspect_angle: found? found.aspect.angle : 0, 
                        type: 1,
                        aspect: found
                    });
                //}
            }
            this.pool.push({
                x: this.x + j * this.step,
                y: this.y + i * this.step,
                name: planets[i],
                type: 0
            });
        }
        this.loaded = true;
        return this.pool;       
    }
    public options(m: any): any {
        let options = { scale: 0.7 };
        if (m.type === 0) {
            return options;
        }
        _.merge(options, aspect_color(m.aspect_angle));
        return options;
        
    }
    public show_aspect_details(m: any): void {
        this.pool = _.flatten(_.partition(this.pool, x => x !== m));
        if (m && m.type === 1 && m.aspect) {  
            this.selected = m;
            const prompt = { prompt: `Write in maximum 30 words interpretation of ${this.selected.aspect.parties[0].name} is in ${this.selected.aspect.aspect.name} with ${this.selected.aspect.parties[1].name} in?`};
            this._response = "... in progress ...";
            this.explain(prompt);
        }
    }
    public get formatted_selected(): string {
        if (!this.selected) { return '' };
        const angle = this.selected.aspect_angle == 0 && this.selected.aspect.angle > 180 ? 360 - this.selected.aspect.angle : this.selected.aspect.angle;
        return `${this.selected.aspect.aspect.name} (${this.selected.aspect_angle}°) : ${convert_DD_to_DMS(angle)}`;
    }

    private _response: string = "";
    public async explain(prompt: any): Promise<void> {
        this.rest.explain(prompt).subscribe((text: string) => {
            this._response = text;
        });
    }

    public get formatted_response(): string[] {     
        if (this._response) {
            //const result = this._response.match(/.{1,60}/g) as string[];
            const chunks: string[] = this._response.split(/\s+/);
            let i = 0;
            const test = _.reduce(chunks, (acc: string[], v: string) => {
                if (acc.length == 0) {
                    acc.push(v);
                } else if (acc[i].length + v.length > 75) {
                    acc.push(v);
                    i++;
                } else {
                    acc[i] += ' ' + v;
                }
                return acc;
            }, []);
            return test;
        }   
        
        return [];
    }
    private _response2: string = "";
    public get has_response(): boolean {
        return this._response2 !== "";
    }
    public get formatted_response2(): string[] {     
        if (this._response2) {
            //const result = this._response.match(/.{1,60}/g) as string[];
            const chunks: string[] = this._response2.split(/\s+/);
            let i = 0;
            const test = _.reduce(chunks, (acc: string[], v: string) => {
                if (acc.length == 0) {
                    acc.push(v);
                } else if (acc[i].length + v.length > 75) {
                    acc.push(v);
                    i++;
                } else {
                    acc[i] += ' ' + v;
                }
                return acc;
            }, []);
            return test;
        }   
        
        return [];
    }
}