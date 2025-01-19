import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss'
})
export class PortfolioComponent implements OnInit{

  profession: string = "";
  professions: string[] = [" Developer", "n Engineer"];

  ngOnInit(): void {
      this.animateProfession();
  }

  async animateProfession() {
    for(let i = 0; i < this.professions.length; i++) {
      for(let j = 0; j < this.professions[i].length; j++) {
        this.profession += this.professions[i][j];
        await this.delay(150);
      }
      await this.delay(1000);
      for(let j = 0; j < this.professions[i].length; j++) {
        this.profession = this.profession.substring(0, this.profession.length - 1);
        await this.delay(150);
      }
    }
    this.animateProfession();
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
