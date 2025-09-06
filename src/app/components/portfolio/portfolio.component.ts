import { Component, OnInit } from '@angular/core';
import { ConfigService } from '../../read-aloud/services/config/config.service';
import { Utils } from '../../read-aloud/utils/Utils';

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss'
})
export class PortfolioComponent implements OnInit{

  get yearsOfExperience() {
    let birthDate = new Date(this.careerStartDate);
    let today = new Date();
    let experience = today.getFullYear() - birthDate.getFullYear();
    let monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      experience--;
    }

    return experience;
  }

  constructor(private configService: ConfigService) {
    this.careerStartDate = this.configService.getConfigValue("CareerStartDate");
  }
  
  careerStartDate = "";
  profession: string = "";
  professions: string[] = [" Developer", "n Engineer"];

  ngOnInit(): void {
    this.configService.getConfigValue("SilentRowSymbol");
      this.animateProfession();
  }

  async animateProfession() {
    for(let i = 0; i < this.professions.length; i++) {
      for(let j = 0; j < this.professions[i].length; j++) {
        this.profession += this.professions[i][j];
        await Utils.delay(150);
      }
      await Utils.delay(1000);
      for(let j = 0; j < this.professions[i].length; j++) {
        this.profession = this.profession.substring(0, this.profession.length - 1);
        await Utils.delay(150);
      }
    }
    this.animateProfession();
  }

}
