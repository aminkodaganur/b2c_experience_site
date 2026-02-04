import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-account.component.html',
  styleUrl: './register-account.component.scss'
})
export class RegisterAccountComponent {
  model = {
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  };

  onSubmit(): void {
    alert('Registration submitted (demo). Email: ' + this.model.email);
  }
}
